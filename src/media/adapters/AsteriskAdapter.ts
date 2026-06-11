import type {
  MediaAdapter,
  CallSession,
  MediaConfig,
  IncomingCallPayload,
} from './MediaAdapter';

/**
 * AsteriskAdapter — Stub implementation for Asterisk PBX.
 *
 * To implement fully:
 * - Use `asterisk-manager` (AMI) or `agi` npm packages
 * - Connect via AMI over TCP on port 5038
 * - Originate calls with `Action: Originate`
 * - Handle events like `Newchannel`, `Hangup`, `DtmfBegin`
 * - Use AGI for call control on individual channels
 * - Stream audio via `RTP` or `asterisk-audio` module
 */

export class AsteriskAdapter implements MediaAdapter {
  readonly provider = 'asterisk';

  async initialize(_config: MediaConfig): Promise<void> {
    // TODO: Connect to Asterisk AMI
    // const ami = new Ami({ host: config.credentials.ASTERISK_HOST, port: 5038,
    //   username: config.credentials.AMI_USER, secret: config.credentials.AMI_SECRET });
    throw new Error('AsteriskAdapter: not implemented yet');
  }

  async handleIncomingCall(_payload: IncomingCallPayload): Promise<CallSession> {
    throw new Error('AsteriskAdapter.handleIncomingCall: not implemented yet');
  }

  async makeCall(_params: { to: string; from: string; agentId?: string }): Promise<CallSession> {
    throw new Error('AsteriskAdapter.makeCall: not implemented yet');
  }

  async startMediaStream(_sessionId: string): Promise<{ streamUrl: string; wsEndpoint?: string }> {
    throw new Error('AsteriskAdapter.startMediaStream: not implemented yet');
  }

  async sendAudio(_sessionId: string, _audioBuffer: Buffer): Promise<void> {
    throw new Error('AsteriskAdapter.sendAudio: not implemented yet');
  }

  async onAudio(_sessionId: string, _callback: (audioChunk: Buffer) => void): Promise<void> {
    throw new Error('AsteriskAdapter.onAudio: not implemented yet');
  }

  async playTTS(_sessionId: string, _text: string): Promise<void> {
    throw new Error('AsteriskAdapter.playTTS: not implemented yet');
  }

  async onDTMF(_sessionId: string, _callback: (digit: string) => void): Promise<void> {
    throw new Error('AsteriskAdapter.onDTMF: not implemented yet');
  }

  async endCall(_sessionId: string): Promise<void> {
    throw new Error('AsteriskAdapter.endCall: not implemented yet');
  }

  async getRecordingUrl(_sessionId: string): Promise<string | null> {
    throw new Error('AsteriskAdapter.getRecordingUrl: not implemented yet');
  }

  async configureTrunk(_config: MediaConfig): Promise<{ success: boolean; trunkId?: string }> {
    throw new Error('AsteriskAdapter.configureTrunk: not implemented yet');
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error'; latency: number }> {
    return { status: 'error', latency: 0 };
  }
}
