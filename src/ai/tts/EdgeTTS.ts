import WebSocket from 'ws';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';

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

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

const VOICE_LIST_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;

const OUTPUT_FORMAT = 'audio-24khz-96kbitrate-mono-mp3';

function generateRequestId(): string {
  return `fac9${randomBytes(8).toString('hex')}f3b5`;
}

function createSSML(text: string, voice: string, rate: string, pitch: string, volume: string): string {
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'>
  <voice name='${voice}'>
    <prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createConfigMessage(requestId: string): string {
  return `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"${OUTPUT_FORMAT}"}}}}`;
}

function createSSMLMessage(requestId: string, ssml: string): string {
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n${ssml}`;
}

export class EdgeTTS {
  async synthesize(text: string, options: EdgeTTSOptions = {}): Promise<Buffer> {
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) throw new Error('No speakable text after sanitization');

    const voice = options.voice || 'tr-TR-EmelNeural';
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0Hz';
    const volume = options.volume || '+0%';

    return new Promise<Buffer>((resolve, reject) => {
      const audioChunks: Buffer[] = [];
      const requestId = generateRequestId();

      const ws = new WebSocket(EDGE_WSS_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
          'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        },
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Edge TTS timeout'));
      }, 30000);

      ws.on('open', () => {
        const configMsg = createConfigMessage(requestId);
        ws.send(configMsg);

        const ssml = createSSML(cleanText, voice, rate, pitch, volume);
        const ssmlMsg = createSSMLMessage(requestId, ssml);
        ws.send(ssmlMsg);
      });

      ws.on('message', (data: Buffer | string, isBinary: boolean) => {
        if (!isBinary) {
          const msg = data.toString();
          if (msg.includes('Path:turn.end')) {
            clearTimeout(timeout);
            ws.close();
            resolve(Buffer.concat(audioChunks));
          }
        } else {
          // Binary audio data — first 2 bytes are header length
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          if (buf.length > 2) {
            const headerLen = buf.readUInt16LE(0);
            const audioData = buf.subarray(2 + headerLen);
            if (audioData.length > 0) {
              audioChunks.push(audioData);
            }
          }
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Edge TTS WebSocket error: ${err.message}`));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          resolve(Buffer.concat(audioChunks));
        }
      });
    });
  }

  async synthesizeRaw(text: string, voice: string, format: string = 'mp3'): Promise<Buffer> {
    return this.synthesize(text, { voice });
  }

  async listVoices(): Promise<EdgeTTSVoice[]> {
    const res = await fetch(VOICE_LIST_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Edge TTS voice list error (${res.status})`);
    }

    const voices: any[] = await res.json();
    return voices
      .filter((v) => v.Locale && v.FriendlyName)
      .map((v) => ({
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
