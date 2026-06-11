export interface CallSession {
  id: string;
  tenantId: string;
  agentId?: string;
  from: string;
  to: string;
  status: 'ringing' | 'in-progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface MediaConfig {
  provider: string;
  type: 'ours' | 'own';
  credentials: Record<string, string>;
  settings?: Record<string, unknown>;
}

export interface IncomingCallPayload {
  callId: string;
  from: string;
  to: string;
  provider: string;
  rawPayload: Record<string, unknown>;
}

export interface MediaAdapter {
  readonly provider: string;

  initialize(config: MediaConfig): Promise<void>;

  handleIncomingCall(payload: IncomingCallPayload): Promise<CallSession>;

  makeCall(params: { to: string; from: string; agentId?: string }): Promise<CallSession>;

  startMediaStream(sessionId: string): Promise<{ streamUrl: string; wsEndpoint?: string }>;

  sendAudio(sessionId: string, audioBuffer: Buffer): Promise<void>;

  onAudio(sessionId: string, callback: (audioChunk: Buffer) => void): Promise<void>;

  playTTS(sessionId: string, text: string): Promise<void>;

  onDTMF(sessionId: string, callback: (digit: string) => void): Promise<void>;

  endCall(sessionId: string): Promise<void>;

  getRecordingUrl(sessionId: string): Promise<string | null>;

  configureTrunk(config: MediaConfig): Promise<{ success: boolean; trunkId?: string }>;

  healthCheck(): Promise<{ status: 'ok' | 'error'; latency: number }>;
}

export type MediaAdapterConstructor = new () => MediaAdapter;
