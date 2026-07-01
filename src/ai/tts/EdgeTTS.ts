// webpack'i atla — eval ile require çağırısı webpack tarafından analiz edilemez
// eslint-disable-next-line no-eval
const _require = eval('require') as NodeRequire;
const WebSocket = _require('ws');

import { randomBytes, createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';

export interface EdgeTTSVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
  locale: string;
}

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const VOICE_LIST_URL = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;

const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.')[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;

function generateSecMsGec(): string {
  let ticks = Date.now() / 1000;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;
  const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  return createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function generateMuid(): string {
  return randomBytes(16).toString('hex').toUpperCase();
}

function generateConnectionId(): string {
  return randomUUID().replace(/-/g, '');
}

function getWsHeaders(): Record<string, string> {
  const muid = generateMuid();
  return {
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': `muid=${muid};`,
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createSSML(text: string, voice: string, rate: string, pitch: string, volume: string): string {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'>
  <voice name='${voice}'>
    <prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;
}

function createConfigMessage(): string {
  return [
    `X-Timestamp:${new Date().toUTCString()}`,
    'Content-Type:application/json; charset=utf-8',
    'Path:speech.config',
    '',
    JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: 'false',
              wordBoundaryEnabled: 'false',
            },
            outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
          },
        },
      },
    }),
  ].join('\r\n');
}

function createSSMLMessage(requestId: string, ssml: string): string {
  const timestamp = new Date().toUTCString();
  return [
    `X-RequestId:${requestId}`,
    'Content-Type:application/ssml+xml',
    `X-Timestamp:${timestamp}Z`,
    'Path:ssml',
    '',
    ssml,
  ].join('\r\n');
}

export class EdgeTTS {
  async synthesize(text: string, options: { voice?: string; rate?: string; pitch?: string; volume?: string } = {}): Promise<Buffer> {
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

    const secMsGec = generateSecMsGec();
    const connectionId = generateConnectionId();
    const requestId = `fac9${randomBytes(8).toString('hex')}f3b5`;

    const wsUrl = `${WSS_URL}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    return new Promise<Buffer>((resolve, reject) => {
      const audioChunks: Buffer[] = [];

      const ws = new WebSocket(wsUrl, {
        headers: getWsHeaders(),
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Edge TTS timeout'));
      }, 30000);

      ws.on('open', () => {
        ws.send(createConfigMessage());
        const ssml = createSSML(cleanText, voice, rate, pitch, volume);
        ws.send(createSSMLMessage(requestId, ssml));
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
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          if (buf.length > 2) {
            const headerLen = buf.readUInt16BE(0);
            const audioData = buf.subarray(2 + headerLen);
            if (audioData.length > 0) {
              audioChunks.push(audioData);
            }
          }
        }
      });

      ws.on('error', (err: any) => {
        clearTimeout(timeout);
        reject(new Error(`Edge TTS error: ${err.message}`));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          resolve(Buffer.concat(audioChunks));
        }
      });
    });
  }

  async listVoices(): Promise<EdgeTTSVoice[]> {
    const res = await fetch(VOICE_LIST_URL, {
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`,
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
