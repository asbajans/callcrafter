import { sleep } from './utils.js';

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

let whisperUrl = process.env.WHISPER_SERVER_URL || 'http://localhost:3502';
let piperUrl = process.env.PIPER_TTS_URL || 'http://localhost:3503';
let appApiUrl = process.env.APP_API_URL || 'http://localhost:3000';
let internalApiKey = process.env.INTERNAL_API_KEY || '';
let elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || '';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

export function initMediaStream(config: {
  whisperServerUrl?: string;
  piperServerUrl?: string;
  appApiUrl?: string;
  internalApiKey?: string;
  elevenLabsApiKey?: string;
}) {
  if (config.whisperServerUrl) whisperUrl = config.whisperServerUrl;
  if (config.piperServerUrl) piperUrl = config.piperServerUrl;
  if (config.appApiUrl) appApiUrl = config.appApiUrl;
  if (config.internalApiKey) internalApiKey = config.internalApiKey;
  if (config.elevenLabsApiKey) elevenLabsApiKey = config.elevenLabsApiKey;
}

export function createSession(callSid: string, streamSid: string, from: string, to: string): CallSession {
  const session: CallSession = {
    callSid, streamSid, from, to, chunks: [], lastChunkTime: Date.now(),
    transcripts: [], isAiSpeaking: false, accumulatedAudio: Buffer.alloc(0), finalized: false,
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

async function transcribeLocal(wavBuffer: Buffer): Promise<string> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
  form.append('audio_file', blob, 'audio.wav');

  const res = await fetch(`${whisperUrl}/asr`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return (data.text || data.segments?.[0]?.text || '').trim();
}

async function synthesizeCloud(text: string, voiceId?: string): Promise<Buffer> {
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!cleanText) throw new Error('No speakable text after sanitization');

  const effectiveVoice = voiceId || '21m00Tcm4TlvDq8ikWAM';

  const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${effectiveVoice}`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: cleanText,
      model_id: 'eleven_flash_v2_5',
      output_format: 'ulaw_8000',
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error (${res.status}): ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function synthesizeLocal(text: string, voiceId?: string): Promise<Buffer> {
  const res = await fetch(`${piperUrl}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voiceId || undefined }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Piper error (${res.status}): ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function processAudio(
  send: (payload: string) => void,
  session: CallSession,
): Promise<string | null> {
  if (session.chunks.length === 0) return null;

  const audioBuffer = Buffer.concat(session.chunks);
  session.chunks = [];

  const { mulawToWav } = await import('./utils.js');
  const wavBuffer = mulawToWav(audioBuffer);

  let transcript = '';
  try {
    transcript = await transcribeLocal(wavBuffer);
    if (!transcript) return null;
    console.log(`Transcript: "${transcript}"`);
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
    const voiceId = data.voiceId as string | undefined;
    const ttsProvider = data.ttsProvider as string | undefined;

    if (!aiResponse) {
      session.isAiSpeaking = false;
      return null;
    }

    session.transcripts.push({ role: 'user', content: transcript });
    session.transcripts.push({ role: 'assistant', content: aiResponse });

    await generateAndSendTTS(send, session, aiResponse, voiceId, ttsProvider);

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
  voiceId?: string,
  ttsProvider?: string,
): Promise<void> {
  try {
    const useCloud = ttsProvider === 'elevenlabs' || (ttsProvider !== 'piper' && elevenLabsApiKey);
    const mulawAudio = useCloud
      ? await synthesizeCloud(text, voiceId)
      : await synthesizeLocal(text, voiceId);

    if (mulawAudio.length === 0) {
      console.error('TTS returned empty audio');
      session.isAiSpeaking = false;
      return;
    }

    console.log(`TTS: ${mulawAudio.length} bytes for "${text.slice(0, 50)}..."`);

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
