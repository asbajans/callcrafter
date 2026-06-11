import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export interface TTSOptions {
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface Voice {
  voiceId: string;
  name: string;
  category?: string;
  language?: string;
  gender?: string;
  previewUrl?: string;
}

export class ElevenLabsTTS {
  private client: ElevenLabsClient;

  constructor(apiKey: string) {
    this.client = new ElevenLabsClient({ apiKey });
  }

  // Text to Speech - returns audio buffer
  async synthesize(text: string, options: TTSOptions): Promise<Buffer> {
    const audioStream = await this.client.textToSpeech.convert(options.voiceId, {
      text,
      modelId: options.modelId || 'eleven_multilingual_v2',
      voiceSettings: {
        stability: options.stability ?? 0.5,
        similarityBoost: options.similarityBoost ?? 0.75,
        style: options.style ?? 0.0,
        useSpeakerBoost: options.useSpeakerBoost ?? true,
      },
    });

    const chunks: Uint8Array[] = [];
    const reader = audioStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return Buffer.from(result);
  }

  // List available voices
  async listVoices(): Promise<Voice[]> {
    const response = await this.client.voices.getAll();
    return (response.voices || []).map((v: any) => ({
      voiceId: v.voiceId,
      name: v.name,
      category: v.category,
      previewUrl: v.previewUrl,
    }));
  }

  // Get voice settings
  async getVoiceSettings(voiceId: string): Promise<any> {
    const response = await this.client.voices.get(voiceId);
    return response.settings;
  }

  // Clone a voice from audio sample
  async cloneVoice(name: string, audioFile: Blob, description?: string): Promise<{ voiceId: string }> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('files', audioFile);
    if (description) formData.append('description', description);
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': (this.client as any).apiKey },
      body: formData,
    });
    const data = await response.json();
    return { voiceId: data.voice_id };
  }

  // Generate preview for a voice
  async generatePreview(voiceId: string, text?: string): Promise<Buffer> {
    return this.synthesize(text || 'Merhaba, ben CallCrafter yapay zeka asistanıyım. Size nasıl yardımcı olabilirim?', {
      voiceId,
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.listVoices();
      return true;
    } catch {
      return false;
    }
  }
}
