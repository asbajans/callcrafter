import OpenAI from 'openai';
import { mulawToWav, sleep } from './utils.js';

interface CallSession {
  callSid: string;
  streamSid: string;
  from: string;
  to: string;
  chunks: Buffer[];
  lastChunkTime: number;
  transcripts: Array<{ role: string; content: string }>;
  isAiSpeaking: boolean;
  accumulatedAudio: Buffer;
  finalized: boolean;
}

const sessions = new Map<string, CallSession>();

const PROCESS_INTERVAL = 1200;
const MAX_CHUNKS_BEFORE_PROCESS = 300;

let openai: OpenAI | null = null;
let appApiUrl = process.env.APP_API_URL || 'http://localhost:3000';
let internalApiKey = process.env.INTERNAL_API_KEY || '';

export function initMediaStream(config: {
  openaiApiKey: string;
  appApiUrl?: string;
  internalApiKey?: string;
}) {
  openai = new OpenAI({ apiKey: config.openaiApiKey });
  if (config.appApiUrl) appApiUrl = config.appApiUrl;
  if (config.internalApiKey) internalApiKey = config.internalApiKey;
}

export function createSession(callSid: string, streamSid: string, from: string, to: string): CallSession {
  const session: CallSession = {
    callSid,
    streamSid,
    from,
    to,
    chunks: [],
    lastChunkTime: Date.now(),
    transcripts: [],
    isAiSpeaking: false,
    accumulatedAudio: Buffer.alloc(0),
    finalized: false,
  };
  sessions.set(callSid, session);
  return session;
}

export function getSession(callSid: string): CallSession | undefined {
  return sessions.get(callSid);
}

export function addAudioChunk(callSid: string, payload: string): void {
  const session = sessions.get(callSid);
  if (!session || session.isAiSpeaking || session.finalized) return;

  const chunk = Buffer.from(payload, 'base64');
  session.chunks.push(chunk);
  session.lastChunkTime = Date.now();
}

export function endSession(callSid: string): void {
  const session = sessions.get(callSid);
  if (!session) return;
  session.finalized = true;
  sessions.delete(callSid);
}

export function sendAudioToTwilio(
  send: (payload: string) => void,
  streamSid: string,
  mulawBuffer: Buffer,
): void {
  const chunkSize = 160;
  for (let i = 0; i < mulawBuffer.length; i += chunkSize) {
    const chunk = mulawBuffer.subarray(i, Math.min(i + chunkSize, mulawBuffer.length));
    send(chunk.toString('base64'));
  }
}

export async function processAudio(
  send: (payload: string) => void,
  session: CallSession,
): Promise<string | null> {
  if (session.chunks.length === 0) return null;

  const audioBuffer = Buffer.concat(session.chunks);
  session.chunks = [];

  const wavBuffer = mulawToWav(audioBuffer);

  let transcript = '';
  try {
    const blob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
    const file = new File([blob], 'audio.wav', { type: 'audio/wav' });

    if (!openai) {
      console.error('STT not initialized');
      return null;
    }

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      response_format: 'text',
    });

    transcript = transcription.trim();
    if (!transcript) return null;

    console.log(`📝 Transcript: "${transcript}"`);
  } catch (err) {
    console.error('STT error:', err);
    return null;
  }

  session.isAiSpeaking = true;

  try {
    const response = await fetch(`${appApiUrl}/api/ai/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalApiKey}`,
      },
      body: JSON.stringify({
        transcript,
        callSid: session.callSid,
        from: session.from,
        to: session.to,
        conversationHistory: session.transcripts.slice(-20),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI process error (${response.status}):`, errorText);
      session.isAiSpeaking = false;
      return null;
    }

    const data = await response.json();
    const aiResponse = data.response as string;

    if (!aiResponse) {
      session.isAiSpeaking = false;
      return null;
    }

    session.transcripts.push({ role: 'user', content: transcript });
    session.transcripts.push({ role: 'assistant', content: aiResponse });

    await generateAndSendTTS(send, session, aiResponse, data.voiceId, data.voiceSettings);

    return aiResponse;
  } catch (err) {
    console.error('AI processing error:', err);
    session.isAiSpeaking = false;
    return null;
  }
}

async function generateAndSendTTS(
  send: (payload: string) => void,
  session: CallSession,
  text: string,
  voiceId: string,
  voiceSettings: any,
): Promise<void> {
  try {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      console.error('ELEVENLABS_API_KEY not set');
      session.isAiSpeaking = false;
      return;
    }

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          output_format: 'ulaw_8000',
          voice_settings: {
            stability: voiceSettings?.stability ?? 0.5,
            similarity_boost: voiceSettings?.similarityBoost ?? 0.75,
            style: voiceSettings?.style ?? 0.0,
            use_speaker_boost: voiceSettings?.useSpeakerBoost ?? true,
          },
        }),
      },
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error(`TTS error (${ttsResponse.status}):`, errorText);
      session.isAiSpeaking = false;
      return;
    }

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const mulawAudio = Buffer.from(arrayBuffer);

    if (mulawAudio.length === 0) {
      console.error('TTS returned empty audio');
      session.isAiSpeaking = false;
      return;
    }

    console.log(`🔊 TTS: ${mulawAudio.length} bytes of ulaw audio for "${text.slice(0, 50)}..."`);

    const chunkSize = 160;
    for (let i = 0; i < mulawAudio.length; i += chunkSize) {
      const chunk = mulawAudio.subarray(i, Math.min(i + chunkSize, mulawAudio.length));
      send(chunk.toString('base64'));
      await sleep(18);
    }
  } catch (err) {
    console.error('TTS error:', err);
  }

  session.isAiSpeaking = false;
}

export function getSessionsCount(): number {
  return sessions.size;
}
