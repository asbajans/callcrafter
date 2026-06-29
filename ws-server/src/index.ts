import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { handleTwilioVoiceWebhook } from './twilio-webhook.js';
import { handleWebSocketConnection } from './websocket.js';
import { initMediaStream, getSessionsCount } from './media-stream.js';
import { handleZadarmaCall, endZadarmaCall, getZadarmaActiveCallCount } from './zadarma-handler.js';

const HTTP_PORT = parseInt(process.env.WS_HTTP_PORT || '8080');
const WS_PORT = parseInt(process.env.WS_WS_PORT || '9090');

// Initialize media stream pipeline with self-hosted STT/TTS
initMediaStream({
  whisperServerUrl: process.env.WHISPER_SERVER_URL || 'http://localhost:3502',
  piperServerUrl: process.env.PIPER_TTS_URL || 'http://localhost:3503',
  appApiUrl: process.env.APP_API_URL || 'http://localhost:3000',
  internalApiKey: process.env.INTERNAL_API_KEY || '',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ws-server' }));

// Twilio voice webhook - handles incoming calls
app.post('/twilio/voice', handleTwilioVoiceWebhook);

// Twilio Media Streams status callbacks
app.post('/twilio/status', (req, res) => {
  const { CallStatus, CallSid } = req.body;
  console.log(`Call ${CallSid} status: ${CallStatus}`);
  res.sendStatus(200);
});

// Zadarma media call initiation
app.post('/zadarma/call', async (req, res) => {
  try {
    const { callId, from, to } = req.body;
    if (!callId) {
      return res.status(400).json({ error: 'callId is required' });
    }
    const result = await handleZadarmaCall({ callId, from: from || '', to: to || '' });
    res.json(result);
  } catch (err) {
    console.error('Zadarma call error:', err);
    res.status(500).json({ error: 'Failed to handle Zadarma call' });
  }
});

// Zadarma call end
app.post('/zadarma/end', (req, res) => {
  const { callId } = req.body;
  if (callId) {
    endZadarmaCall(callId);
  }
  res.json({ status: 'ended' });
});

const httpServer = createServer(app);

// WebSocket server for media streaming
const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', handleWebSocketConnection);

httpServer.listen(HTTP_PORT, () => {
  console.log(`🌐 HTTP server on port ${HTTP_PORT}`);
  console.log(`🔊 WebSocket server on port ${WS_PORT}`);
  console.log(`📡 Twilio webhook: /twilio/voice`);

  setInterval(() => {
    const twilioCount = getSessionsCount();
    const zadarmaCount = getZadarmaActiveCallCount();
    if (twilioCount > 0 || zadarmaCount > 0) {
      console.log(`📊 Active calls - Twilio: ${twilioCount}, Zadarma: ${zadarmaCount}`);
    }
  }, 30000);
});
