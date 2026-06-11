import crypto from 'node:crypto';
import {
  createSession,
  getSession,
  addAudioChunk,
  processAudio,
  sendAudioToTwilio,
} from './media-stream.js';

const ZADARMA_WS_BASE = 'wss://api.zadarma.com/v1/ws';
const ZADARMA_API_BASE = 'https://api.zadarma.com';

interface ZadarmaCallState {
  callSid: string;
  ws: WebSocket | null;
  from: string;
  to: string;
  active: boolean;
}

const activeCalls = new Map<string, ZadarmaCallState>();

export async function handleZadarmaCall(params: {
  callId: string;
  from: string;
  to: string;
}): Promise<{ status: string }> {
  const { callId, from, to } = params;

  if (activeCalls.has(callId)) {
    return { status: 'already_active' };
  }

  const state: ZadarmaCallState = {
    callSid: callId,
    ws: null,
    from,
    to,
    active: true,
  };

  activeCalls.set(callId, state);

  connectToZadarmaWs(callId).catch((err) => {
    console.error(`Zadarma WS connection failed for ${callId}:`, err);
    activeCalls.delete(callId);
  });

  return { status: 'connecting' };
}

async function connectToZadarmaWs(callId: string): Promise<void> {
  const state = activeCalls.get(callId);
  if (!state) return;

  const apiKey = process.env.ZADARMA_API_KEY || '';
  const apiSecret = process.env.ZADARMA_SECRET || '';

  if (!apiKey || !apiSecret) {
    console.error('Zadarma: API credentials not configured');
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const wsUrl = `${ZADARMA_WS_BASE}/calls/${callId}/media`;
  const sigString = `${timestamp}${wsUrl}`;
  const signature = crypto
    .createHmac('sha1', apiSecret)
    .update(sigString)
    .digest('base64');

  createSession(callId, `zadarma_${callId}`, state.from, state.to);

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      api_key: apiKey,
      timestamp,
      signature,
    }));
    console.log(`Zadarma: WS connected for call ${callId}`);
  };

  ws.onmessage = async (event: MessageEvent) => {
    if (!state.active) return;

    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);

        if (msg.event === 'audio' && msg.payload) {
          addAudioChunk(callId, msg.payload);

          const session = getSession(callId);
          if (session && !session.isAiSpeaking) {
            const lastChunkTime = session.lastChunkTime || 0;
            const elapsed = Date.now() - lastChunkTime;
            if (session.chunks.length > 50 && elapsed > 400) {
              const responseText = await processAudio(
                (payload) => sendToZadarma(ws, payload),
                session,
              );
            }
          }
        } else if (msg.event === 'dtmf' && msg.digit) {
          console.log(`Zadarma DTMF on ${callId}: ${msg.digit}`);
        } else if (msg.event === 'error') {
          console.error(`Zadarma error on ${callId}:`, msg.message);
        }
      } catch {
        const chunk = Buffer.from(event.data as string, 'base64');
        if (chunk.length > 0) {
          addAudioChunk(callId, chunk.toString('base64'));
        }
      }
    } else if (event.data instanceof ArrayBuffer) {
      addAudioChunk(callId, Buffer.from(event.data).toString('base64'));
    }
  };

  ws.onclose = (event: CloseEvent) => {
    console.log(`Zadarma: WS closed for ${callId} (code=${event.code})`);
    state.ws = null;
    state.active = false;
    activeCalls.delete(callId);
  };

  ws.onerror = (event: Event) => {
    console.error(`Zadarma: WS error for ${callId}`);
  };

  state.ws = ws;
}

function sendToZadarma(ws: WebSocket, payload: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      event: 'media',
      payload,
    }));
  }
}

export function endZadarmaCall(callId: string): void {
  const state = activeCalls.get(callId);
  if (state?.ws) {
    try { state.ws.close(); } catch { /* ignore */ }
  }
  activeCalls.delete(callId);
}

export function getZadarmaActiveCallCount(): number {
  return activeCalls.size;
}
