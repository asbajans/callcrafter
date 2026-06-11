import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import {
  createSession,
  getSession,
  addAudioChunk,
  endSession,
  processAudio,
  sendAudioToTwilio,
} from './media-stream.js';

const pendingAudioQueues = new Map<string, Array<{ payload: string }>>();
const PROCESS_INTERVAL = 300;
const NEXT_SEGMENT_DELAY = 500;

function sendMedia(ws: WebSocket, streamSid: string, payload: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    event: 'media',
    streamSid,
    media: { payload },
  }));
}

function sendMark(ws: WebSocket, streamSid: string, name: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    event: 'mark',
    streamSid,
    mark: { name },
  }));
}

function clearQueue(ws: WebSocket, streamSid: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    event: 'clear',
    streamSid,
  }));
}

export function handleWebSocketConnection(ws: WebSocket, req: IncomingMessage) {
  const url = new URL(req.url || '/', 'http://localhost');
  const callSid = url.searchParams.get('call') || 'unknown';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';

  console.log(`🔌 WebSocket connected for call: ${callSid}`);

  let streamSid = '';
  let processingInterval: ReturnType<typeof setInterval> | null = null;
  let sessionCreated = false;

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.event) {
        case 'connected':
          console.log(`📞 Media connected for call: ${callSid}`);
          break;

        case 'start':
          streamSid = msg.streamSid;
          const actualCallSid = msg.start?.callSid || callSid;

          if (!sessionCreated) {
            createSession(actualCallSid, streamSid, from || msg.start?.from || '', to || msg.start?.to || '');
            sessionCreated = true;

            if (!pendingAudioQueues.has(actualCallSid)) {
              pendingAudioQueues.set(actualCallSid, []);
            }

            sendMark(ws, streamSid, 'streamStarted');

            processingInterval = setInterval(async () => {
              const session = getSession(actualCallSid);
              if (!session || session.finalized) {
                if (processingInterval) clearInterval(processingInterval);
                return;
              }

              if (session.chunks.length === 0 || session.isAiSpeaking) return;

              const queue = pendingAudioQueues.get(actualCallSid);
              if (queue && queue.length > 0) return;

              const elapsed = Date.now() - session.lastChunkTime;
              if (session.chunks.length > 50 && elapsed > 400) {
                const responseText = await processAudio(
                  (payload) => sendMedia(ws, streamSid, payload),
                  session,
                );

                if (responseText) {
                  setTimeout(() => {
                    if (session && !session.finalized) {
                      session.isAiSpeaking = false;
                    }
                  }, NEXT_SEGMENT_DELAY);
                }
              }
            }, PROCESS_INTERVAL);

            console.log(`🎤 Stream started: ${streamSid} for call ${actualCallSid}`);
          }
          break;

        case 'media':
          if (msg.media?.payload && streamSid) {
            addAudioChunk(callSid, msg.media.payload);
          }
          break;

        case 'stop':
          console.log(`🛑 Stream ended: ${streamSid}`);
          if (processingInterval) clearInterval(processingInterval);
          const session = getSession(callSid);
          if (session && session.chunks.length > 0 && !session.isAiSpeaking) {
            processAudio(
              (payload) => sendMedia(ws, streamSid, payload),
              session,
            ).then(() => {
              endSession(callSid);
            }).catch(() => {
              endSession(callSid);
            });
          } else {
            endSession(callSid);
          }
          break;

        case 'mark':
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`🔌 WebSocket disconnected for call: ${callSid}`);
    if (processingInterval) clearInterval(processingInterval);
    endSession(callSid);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for call ${callSid}:`, err);
    if (processingInterval) clearInterval(processingInterval);
    endSession(callSid);
  });
}
