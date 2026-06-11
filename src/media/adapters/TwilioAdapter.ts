import twilio from 'twilio';
import type {
  MediaAdapter,
  CallSession,
  MediaConfig,
  IncomingCallPayload,
} from './MediaAdapter';

interface ActiveCall {
  session: CallSession;
  audioCallbacks: Set<(chunk: Buffer) => void>;
  dtmfCallbacks: Set<(digit: string) => void>;
}

export class TwilioAdapter implements MediaAdapter {
  readonly provider = 'twilio';

  private client: twilio.Twilio | null = null;
  private config: MediaConfig | null = null;
  private wsPublicUrl: string = '';
  private wsServerUrl: string = '';
  private activeCalls = new Map<string, ActiveCall>();

  async initialize(config: MediaConfig): Promise<void> {
    this.config = config;
    this.client = twilio(config.credentials.TWILIO_ACCOUNT_SID, config.credentials.TWILIO_AUTH_TOKEN);
    this.wsPublicUrl = process.env.WS_PUBLIC_URL || 'wss://your-domain.com';
    this.wsServerUrl = process.env.WS_SERVER_URL || 'http://ws-server:8080';
    console.log('TwilioAdapter initialized');
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
      audioCallbacks: new Set(),
      dtmfCallbacks: new Set(),
    });

    return session;
  }

  async makeCall(params: { to: string; from: string; agentId?: string }): Promise<CallSession> {
    if (!this.client) {
      throw new Error('TwilioAdapter: not initialized. Call initialize() first.');
    }

    const call = await this.client.calls.create({
      to: params.to,
      from: params.from,
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/twilio/outbound`,
      statusCallback: `${this.wsServerUrl}/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    const session: CallSession = {
      id: call.sid,
      tenantId: '',
      agentId: params.agentId,
      from: params.from,
      to: params.to,
      status: 'ringing',
      startTime: new Date(),
    };

    this.activeCalls.set(session.id, {
      session,
      audioCallbacks: new Set(),
      dtmfCallbacks: new Set(),
    });

    return session;
  }

  async startMediaStream(sessionId: string): Promise<{ streamUrl: string; wsEndpoint?: string }> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`TwilioAdapter: call session ${sessionId} not found`);
    }

    return {
      streamUrl: `${this.wsPublicUrl}/?call=${sessionId}`,
      wsEndpoint: this.wsPublicUrl,
    };
  }

  async sendAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`TwilioAdapter: call session ${sessionId} not found`);
    }
    console.log(`Audio queued for session ${sessionId}`);
  }

  async onAudio(sessionId: string, callback: (audioChunk: Buffer) => void): Promise<void> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`TwilioAdapter: call session ${sessionId} not found`);
    }
    active.audioCallbacks.add(callback);
  }

  async playTTS(sessionId: string, text: string): Promise<void> {
    if (!this.client) {
      throw new Error('TwilioAdapter: not initialized');
    }

    await this.client.calls(sessionId).update({
      twiml: `<Response><Say voice="alice" language="en-US">${this.escapeXml(text)}</Say></Response>`,
    });
  }

  async onDTMF(sessionId: string, callback: (digit: string) => void): Promise<void> {
    const active = this.activeCalls.get(sessionId);
    if (!active) {
      throw new Error(`TwilioAdapter: call session ${sessionId} not found`);
    }
    active.dtmfCallbacks.add(callback);
  }

  async endCall(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('TwilioAdapter: not initialized');
    }

    try {
      await this.client.calls(sessionId).update({ status: 'completed' });
    } finally {
      this.activeCalls.delete(sessionId);
    }
  }

  async getRecordingUrl(sessionId: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('TwilioAdapter: not initialized');
    }

    const recordings = await this.client.recordings.list({ callSid: sessionId, limit: 1 });

    if (recordings.length === 0) {
      return null;
    }

    return `https://api.twilio.com/2010-04-01/Accounts/${recordings[0].accountSid}/Recordings/${recordings[0].sid}.mp3`;
  }

  async configureTrunk(config: MediaConfig): Promise<{ success: boolean; trunkId?: string }> {
    if (!this.client) {
      throw new Error('TwilioAdapter: not initialized');
    }

    try {
      const trunk = await this.client.trunking.trunks.create({
        friendlyName: config.settings?.friendlyName as string | undefined,
      });

      return { success: true, trunkId: trunk.sid };
    } catch (error) {
      return { success: false };
    }
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error'; latency: number }> {
    const start = Date.now();

    try {
      if (!this.client) {
        throw new Error('Not initialized');
      }
      await this.client.api.accounts(this.client.accountSid).fetch();
      return { status: 'ok', latency: Date.now() - start };
    } catch {
      return { status: 'error', latency: Date.now() - start };
    }
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
