import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export interface EdgeTTSVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
  locale: string;
}

export interface EdgeTTSOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

export class EdgeTTS {
  async synthesize(text: string, options: EdgeTTSOptions = {}): Promise<Buffer> {
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) throw new Error('No speakable text after sanitization');

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      options.voice || 'tr-TR-EmelNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    const { audioStream } = tts.toStream(cleanText, {
      rate: options.rate || '+0%',
      pitch: options.pitch || '+0Hz',
      volume: options.volume || '+0%',
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async synthesizeRaw(text: string, voice: string, format: string = 'mp3'): Promise<Buffer> {
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) throw new Error('No speakable text after sanitization');

    const outputFormat = format === 'webm'
      ? OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS
      : OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, outputFormat);

    const { audioStream } = tts.toStream(cleanText);

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async listVoices(): Promise<EdgeTTSVoice[]> {
    const tts = new MsEdgeTTS();
    const voices = await tts.getVoices();
    return voices
      .filter((v: any) => v.Locale && v.FriendlyName)
      .map((v: any) => ({
        id: v.ShortName,
        name: v.FriendlyName,
        language: v.Locale?.split('-')[0] || '',
        gender: v.Gender || 'Unknown',
        locale: v.Locale || '',
      }));
  }

  async listVoicesByLocale(locale: string): Promise<EdgeTTSVoice[]> {
    const allVoices = await this.listVoices();
    return allVoices.filter((v) => v.locale.startsWith(locale));
  }
}

export const edgeTTS = new EdgeTTS();
