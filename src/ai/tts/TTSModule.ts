import { Readable } from 'node:stream';

export interface TTSOptions {
  stability?: number;
  similarityBoost?: number;
  speed?: number;
  style?: number;
  language?: string;
  modelId?: string;
}

export interface Voice {
  voiceId: string;
  name: string;
  category?: string;
  description?: string;
  previewUrl?: string;
  settings?: VoiceSettings;
}

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  speed: number;
  style?: number;
}

export class TTSModule {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async synthesize(text: string, voiceId: string, options?: TTSOptions): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        model_id: options?.modelId ?? 'eleven_multilingual_v2',
        voice_settings: {
          stability: options?.stability ?? 0.5,
          similarity_boost: options?.similarityBoost ?? 0.75,
          speed: options?.speed ?? 1.0,
          style: options?.style ?? 0.0,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTSModule: ElevenLabs API error (${response.status}): ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getVoices(): Promise<Voice[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`TTSModule: failed to fetch voices (${response.status})`);
    }

    const data = (await response.json()) as { voices: Voice[] };
    return data.voices;
  }

  async getVoiceSettings(voiceId: string): Promise<VoiceSettings> {
    const response = await fetch(`${this.baseUrl}/voices/${voiceId}/settings`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`TTSModule: failed to fetch voice settings (${response.status})`);
    }

    return response.json() as Promise<VoiceSettings>;
  }

  async streamTTS(text: string, voiceId: string): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 1.0,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`TTSModule: streaming TTS failed (${response.status})`);
    }

    return response.body!;
  }

  private getHeaders(): Record<string, string> {
    return {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }
}
