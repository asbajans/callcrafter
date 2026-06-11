import crypto from 'node:crypto';
import type {
  MediaAdapter,
  CallSession,
  MediaConfig,
  IncomingCallPayload,
} from './MediaAdapter';

const ZADARMA_API_BASE = 'https://api.zadarma.com';
const ZADARMA_WS_BASE = 'wss://api.zadarma.com/v1/ws';

interface ActiveCall {
  session: CallSession;
  ws: WebSocket | null;
  audioCallbacks: Set<(chunk: Buffer) => void>;
  dtmfCallbacks: Set<(digit: string) => void>;
  reconnectAttempts: number;
  lastAudioTime: number;
}

export class ZadarmaAdapter implements MediaAdapter {
  readonly provider = 'zadarma';

  private apiKey = '';
  private apiSecret = '';
  private activeCalls = new Map<string, ActiveCall>();
  private mediaPort = 3502;

  async initialize(config: MediaConfig): Promise<void> {
    this.apiKey = config.credentials.ZADARMA_API_KEY;
    this.apiSecret = config.credentials.ZADARMA_API_SECRET;

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('ZadarmaAdapter: ZADARMA_API_KEY and ZADARMA_API_SECRET are required');
    }
  }

  async handleIncomingCall(payload: IncomingCallPayload): Promise<CallSession> {
    const session: CallSession = {
      id: payload.callId,
      tenantId: '',
      from: payload.from,
      to: payload.to,
      status: 'ringing',
      startTime: new Date(),
      metadata: payload.rawPayload,
    };

    this.activeCalls.set(session.id, {
      session,
      ws: null,
      audioCallbacks: new Set(),
      dtmfCallbacks: new Set(),
      reconnectAttempts: 0,
      lastAudioTime: 0,
    });

    return session;
  }

  async makeCall(params: { to: string; from: string; agentId?: string }): Promise<CallSession> {
    const body = new URLSearchParams({
      to: params.to,
      from: params.from,
    }).toString();

    const data = await this.apiRequest<{
      call_id: string;
      status: string;
    }>('/v1/request/call/parallel/', 'POST', body);

    const session: CallSession = {
      id: data.call_id,
      tenantId: '',
      agentId: params.agentId,
      from: params.from,
      to: params.to,
      status: data.status === 'success' ? 'ringing' : 'failed',
      startTime: new Date(),
    };

    this.activeCalls.set(session.id, {
      session,
      ws: null,
      audioCallbacks: new Set(),
      dtmfCallbacks: new Set(),
      reconnectAttempts: 0,
      lastAudioTime: 0,
    });

    return session;
  }

  async startMediaStream(sessionId: string): Promise<{ streamUrl: string; wsEndpoint?: string }> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`ZadarmaAdapter: call session ${sessionId} not found`);
    }

    this.connectWebSocket(sessionId);

    return {
      streamUrl: `${ZADARMA_API_BASE}/v1/playback/${sessionId}/`,
      wsEndpoint: `${ZADARMA_WS_BASE}/calls/${sessionId}/media`,
    };
  }

  async sendAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`ZadarmaAdapter: call session ${sessionId} not found`);
    }

    if (active.ws && active.ws.readyState === WebSocket.OPEN) {
      active.ws.send(audioBuffer);
      active.lastAudioTime = Date.now();
    } else {
      await this.apiRequest(
        `/v1/calls/${sessionId}/send_audio/`,
        'POST',
        audioBuffer.toString('base64'),
        'text/plain',
      );
    }
  }

  async onAudio(sessionId: string, callback: (audioChunk: Buffer) => void): Promise<void> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`ZadarmaAdapter: call session ${sessionId} not found`);
    }
    active.audioCallbacks.add(callback);

    if (!active.ws) {
      this.connectWebSocket(sessionId);
    }
  }

  async playTTS(sessionId: string, text: string): Promise<void> {
    const encodedText = Buffer.from(text, 'utf-8').toString('base64');
    await this.apiRequest('/v1/ivm/play/', 'PUT', JSON.stringify({
      call_id: sessionId,
      text: encodedText,
      lang: 'auto',
    }));
  }

  async onDTMF(sessionId: string, callback: (digit: string) => void): Promise<void> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`ZadarmaAdapter: call session ${sessionId} not found`);
    }
    active.dtmfCallbacks.add(callback);
  }

  async endCall(sessionId: string): Promise<void> {
    const active = this.activeCalls.get(sessionId);
    if (active?.ws) {
      try { active.ws.close(); } catch { /* ignore */ }
    }

    try {
      await this.apiRequest('/v1/request/call/hangup/', 'POST', `call_id=${sessionId}`);
    } finally {
      this.activeCalls.delete(sessionId);
    }
  }

  async getRecordingUrl(sessionId: string): Promise<string | null> {
    try {
      const data = await this.apiRequest<{ link: string }>(
        '/v1/record/request/',
        'POST',
        `call_id=${sessionId}&lifetime=3600`,
      );
      return data.link;
    } catch {
      return null;
    }
  }

  async configureTrunk(config: MediaConfig): Promise<{ success: boolean; trunkId?: string }> {
    try {
      const data = await this.apiRequest<{ sip_id: string }>(
        '/v1/sip/add/',
        'POST',
        JSON.stringify(config.credentials),
      );
      return { success: true, trunkId: data.sip_id };
    } catch {
      return { success: false };
    }
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error'; latency: number }> {
    const start = Date.now();
    try {
      await this.apiRequest('/v1/info/balance/', 'GET');
      return { status: 'ok', latency: Date.now() - start };
    } catch {
      return { status: 'error', latency: Date.now() - start };
    }
  }

  private connectWebSocket(sessionId: string): void {
    const active = this.activeCalls.get(sessionId);
    if (!active || active.ws) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.buildWsSignature(timestamp, sessionId);
    const wsUrl = `${ZADARMA_WS_BASE}/calls/${sessionId}/media`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          api_key: this.apiKey,
          timestamp,
          signature,
        }));
        active.reconnectAttempts = 0;
        console.log(`Zadarma: WebSocket connected for call ${sessionId}`);
      };

      ws.onmessage = async (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'audio' && msg.payload) {
              const chunk = Buffer.from(msg.payload, 'base64');
              active.lastAudioTime = Date.now();
              active.audioCallbacks.forEach((cb) => cb(chunk));
            } else if (msg.event === 'dtmf' && msg.digit) {
              active.dtmfCallbacks.forEach((cb) => cb(msg.digit));
            } else if (msg.event === 'error') {
              console.error(`Zadarma WS error for ${sessionId}:`, msg.message);
            }
          } catch {
            const chunk = Buffer.from(event.data as string, 'base64');
            if (chunk.length > 0) {
              active.lastAudioTime = Date.now();
              active.audioCallbacks.forEach((cb) => cb(chunk));
            }
          }
        } else if (event.data instanceof ArrayBuffer) {
          const buf = Buffer.from(event.data);
          active.lastAudioTime = Date.now();
          active.audioCallbacks.forEach((cb) => cb(buf));
        } else if (event.data instanceof Blob) {
          const arrayBuf = await (event.data as Blob).arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          active.lastAudioTime = Date.now();
          active.audioCallbacks.forEach((cb) => cb(buf));
        }
      };

      ws.onclose = (event: CloseEvent) => {
        console.log(`Zadarma: WS closed for ${sessionId} (code=${event.code})`);
        active.ws = null;
        if (!active.session.endTime && active.reconnectAttempts < 3) {
          active.reconnectAttempts++;
          setTimeout(() => this.connectWebSocket(sessionId), 2000 * active.reconnectAttempts);
        }
      };

      ws.onerror = (event: Event) => {
        console.error(`Zadarma: WS error for ${sessionId}`);
      };

      active.ws = ws;
    } catch (err) {
      console.error(`Zadarma: Failed to connect WebSocket for ${sessionId}:`, err);
    }
  }

  private buildWsSignature(timestamp: number, sessionId: string): string {
    const sigString = `${timestamp}wss://api.zadarma.com/v1/ws/calls/${sessionId}/media`;
    return crypto.createHmac('sha1', this.apiSecret).update(sigString).digest('base64');
  }

  private async apiRequest<T = unknown>(
    path: string,
    method: string,
    body?: string,
    contentType?: string,
  ): Promise<T> {
    const url = `${ZADARMA_API_BASE}${path}`;
    const headers = this.buildHeaders(method, url, body ?? '');

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(url, { method, headers, body });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zadarma API error (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private buildHeaders(method: string, url: string, body: string): Record<string, string> {
    const now = Math.floor(Date.now() / 1000);
    const md5body = crypto.createHash('md5').update(body).digest('hex');
    const sigString = `${now}${method}${url}${md5body}`;
    const signature = crypto
      .createHmac('sha1', this.apiSecret)
      .update(sigString)
      .digest('base64');

    return {
      Authorization: `${this.apiKey}:${signature}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }
}
