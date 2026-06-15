import * as net from 'net'
import type {
  MediaAdapter,
  CallSession,
  MediaConfig,
  IncomingCallPayload,
} from './MediaAdapter'

interface AmiAction {
  action: string
  [key: string]: any
}

export class AsteriskAdapter implements MediaAdapter {
  readonly provider = 'asterisk'

  private host = '127.0.0.1'
  private port = 5038
  private username = 'admin'
  private secret = 'admin'
  private outboundContext = 'outbound-trunk'
  private defaultAgentExtension = '1000'
  private sipEndpoint = 'voip'
  private recordCalls = true
  private agentExtensions = ['1000', '1001', '1002', '1003']
  private initialized = false

  private activeSessions = new Map<string, {
    channel: string
    callReference: string
    status: CallSession['status']
    startTime: Date
  }>()

  async initialize(config: MediaConfig): Promise<void> {
    const c = config.credentials
    this.host = c.ASTERISK_HOST || '127.0.0.1'
    this.port = parseInt(c.ASTERISK_AMI_PORT || '5038', 10)
    this.username = c.AMI_USER || 'admin'
    this.secret = c.AMI_SECRET || 'admin'
    this.outboundContext = c.OUTBOUND_CONTEXT || 'outbound-trunk'
    this.defaultAgentExtension = c.DEFAULT_AGENT_EXTENSION || '1000'
    this.sipEndpoint = c.SIP_ENDPOINT || 'voip'
    this.recordCalls = c.RECORD_CALLS !== 'false'
    if (c.AGENT_EXTENSIONS) {
      this.agentExtensions = c.AGENT_EXTENSIONS.split(',').map((s: string) => s.trim())
    }
    this.initialized = true
  }

  async handleIncomingCall(payload: IncomingCallPayload): Promise<CallSession> {
    const session: CallSession = {
      id: payload.callId,
      tenantId: '',
      from: payload.from,
      to: payload.to,
      status: 'in-progress',
      startTime: new Date(),
      metadata: { provider: payload.provider, ...payload.rawPayload },
    }
    return session
  }

  async makeCall(params: { to: string; from: string; agentId?: string }): Promise<CallSession> {
    if (!this.initialized) throw new Error('AsteriskAdapter not initialized')

    const agentExtension = await this.resolveAgentExtension(params.agentId)
    const targetNumber = this.normalizePhoneNumber(params.to)
    const callReference = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const dialString = this.buildDialString(agentExtension, targetNumber)
    const callerId = params.from || ''

    const response = await this.sendAmiAction({
      action: 'Originate',
      channel: `PJSIP/${agentExtension}`,
      context: this.outboundContext,
      exten: targetNumber,
      priority: 1,
      timeout: 30000,
      callerid: callerId,
      variable: `TRUNK_NAME=${this.sipEndpoint},TRUNK_DIAL=${dialString},CALL_REFERENCE=${callReference},EMARE_RECORD_CALL=${this.recordCalls}`,
      async: true,
    })

    const sessionId = `asterisk_${callReference}`
    this.activeSessions.set(sessionId, {
      channel: response.Channel || `PJSIP/${agentExtension}`,
      callReference,
      status: 'ringing',
      startTime: new Date(),
    })

    return {
      id: sessionId,
      tenantId: '',
      agentId: params.agentId,
      from: params.from,
      to: params.to,
      status: 'ringing',
      startTime: new Date(),
      metadata: { callReference, agentExtension, targetNumber },
    }
  }

  async startMediaStream(sessionId: string): Promise<{ streamUrl: string; wsEndpoint?: string }> {
    throw new Error('Asterisk media streaming requires external WebRTC setup')
  }

  async sendAudio(_sessionId: string, _audioBuffer: Buffer): Promise<void> {
    throw new Error('Asterisk sendAudio not supported via AMI')
  }

  async onAudio(_sessionId: string, _callback: (audioChunk: Buffer) => void): Promise<void> {
    throw new Error('Asterisk onAudio not supported via AMI')
  }

  async playTTS(sessionId: string, text: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)

    const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ')
    await this.sendAmiAction({
      action: 'Setvar',
      channel: session.channel,
      variable: 'TTS_TEXT',
      value: safeText,
    })

    await this.sendAmiAction({
      action: 'Originate',
      channel: `Local/tts@play-tts`,
      context: 'play-tts',
      exten: 's',
      priority: 1,
      timeout: 30000,
      variable: `TTS_TEXT=${safeText},CHANNEL_TO_ANNOUNCE=${session.channel}`,
      async: true,
    })
  }

  async onDTMF(_sessionId: string, _callback: (digit: string) => void): Promise<void> {
    throw new Error('Asterisk DTMF events require AMI event listener')
  }

  async endCall(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)

    const channel = await this.findChannelByReference(session.callReference)
    if (channel) {
      await this.sendAmiAction({ action: 'Hangup', channel })
    }

    this.activeSessions.delete(sessionId)
  }

  async getRecordingUrl(sessionId: string): Promise<string | null> {
    const session = this.activeSessions.get(sessionId)
    if (!session) return null
    return `/asterisk/recordings/${session.callReference}.wav`
  }

  async configureTrunk(config: MediaConfig): Promise<{ success: boolean; trunkId?: string }> {
    try {
      await this.initialize(config)
      const result = await this.healthCheck()
      return { success: result.status === 'ok', trunkId: `asterisk_${Date.now()}` }
    } catch {
      return { success: false }
    }
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error'; latency: number }> {
    const start = Date.now()
    try {
      await this.sendAmiAction({ action: 'Ping' })
      return { status: 'ok', latency: Date.now() - start }
    } catch {
      return { status: 'error', latency: Date.now() - start }
    }
  }

  private async sendAmiAction(action: AmiAction): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      const timeout = 10000
      let buffer = ''
      const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      action.actionid = actionId

      socket.setTimeout(timeout)
      socket.connect(this.port, this.host, () => {
        const login = `Action: Login\r\nUsername: ${this.username}\r\nSecret: ${this.secret}\r\nEvents: off\r\n\r\n`
        socket.write(login)
      })

      let loggedIn = false

      socket.on('data', (data: Buffer) => {
        buffer += data.toString()
        if (buffer.includes('Message: Authentication accepted') || buffer.includes('Response: Success')) {
          if (!loggedIn) {
            loggedIn = true
            const actionStr = Object.entries(action)
              .map(([k, v]) => `${k.replace(/([A-Z])/g, '_$1').toUpperCase()}: ${v}`)
              .join('\r\n')
            socket.write(`${actionStr}\r\n\r\n`)
          }
        }

        if (buffer.includes(`ActionID: ${actionId}`) && (buffer.includes('Response: Success') || buffer.includes('Response: Error'))) {
          socket.destroy()
          const lines = buffer.split('\r\n')
          const result: Record<string, string> = {}
          for (const line of lines) {
            const colonIdx = line.indexOf(': ')
            if (colonIdx > 0) {
              const key = line.slice(0, colonIdx).toLowerCase()
              const val = line.slice(colonIdx + 2)
              result[key] = val
            }
          }

          if (result.response === 'Error') {
            reject(new Error(result.message || 'AMI action failed'))
          } else {
            resolve(result)
          }
        }
      })

      socket.on('error', (err) => {
        socket.destroy()
        reject(new Error(`AMI connection failed: ${err.message}`))
      })

      socket.on('timeout', () => {
        socket.destroy()
        reject(new Error('AMI connection timeout'))
      })
    })
  }

  private async findChannelByReference(callReference: string): Promise<string | null> {
    try {
      const result = await this.sendAmiAction({ action: 'Command', command: 'core show channels concise' })
      const output = result.data || ''
      const lines = output.split('\n')

      for (const line of lines) {
        if (line.includes(callReference)) {
          return line.split('!')[0]
        }
      }
      return null
    } catch {
      return null
    }
  }

  private async resolveAgentExtension(agentId?: string): Promise<string> {
    if (agentId && this.agentExtensions.includes(agentId)) {
      return agentId
    }
    return this.defaultAgentExtension
  }

  private buildDialString(agentExtension: string, targetNumber: string): string {
    return `PJSIP/${this.sipEndpoint}/sip:${targetNumber}@${this.host}:${this.getSipPort()}`
  }

  private getSipPort(): number {
    return 5060
  }

  private normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '')
    if (cleaned.startsWith('+90')) {
      cleaned = `0${cleaned.slice(2)}`
    } else if (cleaned.startsWith('90')) {
      cleaned = `0${cleaned.slice(2)}`
    } else if (!cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = `0${cleaned}`
    }
    if (cleaned.length > 15) cleaned = cleaned.slice(0, 15)
    return cleaned
  }
}
