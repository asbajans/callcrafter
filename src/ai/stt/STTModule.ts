import OpenAI from 'openai';
import { type ReadableStream } from 'node:stream/web';

export interface StreamTranscriber {
  onTranscript: (text: string, isFinal: boolean) => void;
  send(audioChunk: Buffer): void;
  end(): void;
}

interface SpeechDetectionResult {
  hasSpeech: boolean;
  startTime: number;
  endTime: number;
}

export class STTModule {
  private openai: OpenAI;

  constructor(config: { openaiApiKey: string }) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async transcribe(audioBuffer: Buffer, language?: string): Promise<string> {
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
    const file = new File([blob], 'audio.wav', { type: 'audio/wav' });

    const transcription = await this.openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language,
      response_format: 'text',
    });

    return transcription;
  }

  createStreamTranscriber(): StreamTranscriber {
    const transcriber: StreamTranscriber = {
      onTranscript: () => {},
      send: () => {},
      end: () => {},
    };

    // In production, use OpenAI's real-time API or Deepgram's streaming
    // For now, provide a buffered approach that collects audio and transcribes on end
    const chunks: Buffer[] = [];

    transcriber.send = (audioChunk: Buffer) => {
      chunks.push(audioChunk);
    };

    transcriber.end = async () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const text = await this.transcribe(fullBuffer);
        transcriber.onTranscript(text, true);
      } catch (error) {
        console.error('STTModule: streaming transcription error:', error);
      }
    };

    return transcriber;
  }

  async detectSpeech(audioBuffer: Buffer): Promise<SpeechDetectionResult> {
    // Simple energy-based VAD
    // In production, use webrtcvad or silero-vad
    const sampleRate = 16000;
    const bytesPerSample = 2;
    const samples = audioBuffer.length / bytesPerSample;
    const frameSize = Math.floor(sampleRate * 0.03); // 30ms frames
    const energyThreshold = 500;

    let hasSpeech = false;
    let startTime = -1;
    let endTime = -1;
    let speechFrames = 0;

    for (let i = 0; i < samples; i += frameSize) {
      const frameStart = i * bytesPerSample;
      const frameEnd = Math.min(frameStart + frameSize * bytesPerSample, audioBuffer.length);
      let energy = 0;
      let count = 0;

      for (let j = frameStart; j < frameEnd - 1; j += 2) {
        const sample = audioBuffer.readInt16LE(j);
        energy += Math.abs(sample);
        count++;
      }

      energy /= count;
      const frameTime = (i / sampleRate) * 1000;

      if (energy > energyThreshold) {
        if (!hasSpeech) {
          hasSpeech = true;
          startTime = frameTime;
        }
        speechFrames++;
        endTime = frameTime + 30;
      }
    }

    // Require at least 3 consecutive speech frames (90ms) to avoid noise
    if (speechFrames < 3) {
      hasSpeech = false;
      startTime = -1;
      endTime = -1;
    }

    return { hasSpeech, startTime, endTime };
  }
}
