export interface VoiceConfig {
  id: string;
  name: string;
  voiceId: string;
  provider: string;
  language?: string;
  previewUrl?: string;
  settings?: Record<string, unknown>;
}

export class VoiceDatabase {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(config: { elevenlabsApiKey: string }) {
    this.apiKey = config.elevenlabsApiKey;
  }

  async getVoices(tenantId: string): Promise<VoiceConfig[]> {
    // In production, load from DB per tenant
    // For now, fetch from ElevenLabs API
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`VoiceDatabase: failed to fetch voices (${response.status})`);
    }

    const data = (await response.json()) as { voices: Array<{ voice_id: string; name: string; category?: string; preview_url?: string }> };

    return data.voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      voiceId: v.voice_id,
      provider: 'elevenlabs',
      previewUrl: v.preview_url,
    }));
  }

  async cloneVoice(name: string, audioFile: Buffer, language?: string): Promise<VoiceConfig> {
    const formData = new FormData();
    formData.append('name', name);

    const blob = new Blob([new Uint8Array(audioFile)], { type: 'audio/wav' });
    formData.append('files', blob, 'voice_sample.wav');

    if (language) {
      formData.append('language', language);
    }

    const response = await fetch(`${this.baseUrl}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VoiceDatabase: voice cloning failed (${response.status}): ${error}`);
    }

    const data = (await response.json()) as { voice_id: string };

    return {
      id: data.voice_id,
      name,
      voiceId: data.voice_id,
      provider: 'elevenlabs',
      language,
    };
  }

  async generatePreview(voiceId: string, text?: string): Promise<string> {
    const payload: { voice_id: string; text: string } = {
      voice_id: voiceId,
      text: text ?? 'Hello, this is a preview of my voice.',
    };

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text: payload.text,
        model_id: 'eleven_multilingual_v2',
      }),
    });

    if (!response.ok) {
      throw new Error(`VoiceDatabase: preview generation failed (${response.status})`);
    }

    // Return a preview URL — in production, upload the stream to a CDN
    return `${this.baseUrl}/text-to-speech/${voiceId}/stream?preview=true`;
  }

  async testVoice(voiceId: string, text: string): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
      }),
    });

    if (!response.ok) {
      throw new Error(`VoiceDatabase: voice test failed (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private getHeaders(): Record<string, string> {
    return {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }
}
