import * as net from 'net'

export interface AsteriskAmiConfig {
  host: string
  port: number
  username: string
  secret: string
}

export interface AmiCallResult {
  success: boolean
  channel?: string
  callReference?: string
  message?: string
}

export class AsteriskManagerService {
  private config: AsteriskAmiConfig

  constructor(config: AsteriskAmiConfig) {
    this.config = config
  }

  async initiateOutboundCall(params: {
    agentExtension: string
    targetNumber: string
    callerId?: string
    trunkName?: string
    trunkDial?: string
    context?: string
    recordCalls?: boolean
  }): Promise<AmiCallResult> {
    const callReference = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const normalizedTarget = this.normalizePhoneNumber(params.targetNumber)
    const context = params.context || 'outbound-trunk'

    const variables = [
      `CALL_REFERENCE=${callReference}`,
      `DISPLAY_TO=${normalizedTarget}`,
      `DISPLAY_FROM=${params.callerId || ''}`,
    ]

    if (params.trunkName) variables.push(`TRUNK_NAME=${params.trunkName}`)
    if (params.trunkDial) variables.push(`TRUNK_DIAL=${params.trunkDial}`)
    if (params.recordCalls !== false) variables.push('EMARE_RECORD_CALL=true')

    try {
      const result = await this.sendAction({
        action: 'Originate',
        channel: `PJSIP/${params.agentExtension}`,
        context,
        exten: normalizedTarget,
        priority: 1,
        timeout: 30000,
        callerid: params.callerId || normalizedTarget,
        variable: variables.join(','),
        async: true,
      })

      return {
        success: result.response === 'Success',
        channel: result.channel,
        callReference,
        message: result.message,
      }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  }

  async hangupCall(callReference: string): Promise<boolean> {
    try {
      const channel = await this.findChannelByReference(callReference)
      if (channel) {
        await this.sendAction({ action: 'Hangup', channel })
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async ping(): Promise<{ success: boolean; latency: number }> {
    const start = Date.now()
    try {
      const result = await this.sendAction({ action: 'Ping' })
      return { success: result.response === 'Success', latency: Date.now() - start }
    } catch {
      return { success: false, latency: Date.now() - start }
    }
  }

  async originate(params: {
    channel: string
    context: string
    exten: string
    priority?: number
    timeout?: number
    callerId?: string
    variables?: Record<string, string>
    async?: boolean
  }): Promise<any> {
    const action: Record<string, any> = {
      action: 'Originate',
      channel: params.channel,
      context: params.context,
      exten: params.exten,
      priority: params.priority || 1,
      timeout: params.timeout || 30000,
    }

    if (params.callerId) action.callerid = params.callerId
    if (params.async !== false) action.async = true
    if (params.variables) {
      action.variable = Object.entries(params.variables)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    }

    return this.sendAction(action)
  }

  private async findChannelByReference(callReference: string): Promise<string | null> {
    try {
      const result = await this.sendAction({
        action: 'Command',
        command: 'core show channels concise',
      })

      const output = result.data || ''
      const lines = output.split('\n')

      for (const line of lines) {
        if (line.includes(callReference)) {
          const parts = line.split('!')
          return parts[0] || null
        }
      }
      return null
    } catch {
      return null
    }
  }

  private async sendAction(action: Record<string, any>): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      const timeout = 10000
      let buffer = ''
      const actionId = `ami_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      action.actionid = actionId

      socket.setTimeout(timeout)
      socket.connect(this.config.port, this.config.host, () => {
        const login = `Action: Login\r\nUsername: ${this.config.username}\r\nSecret: ${this.config.secret}\r\nEvents: off\r\n\r\n`
        socket.write(login)
      })

      let loggedIn = false

      socket.on('data', (data: Buffer) => {
        buffer += data.toString()

        if (buffer.includes('Message: Authentication accepted') && !loggedIn) {
          loggedIn = true
          const actionStr = Object.entries(action)
            .map(([k, v]) => `${k.replace(/([A-Z])/g, '_$1').toUpperCase()}: ${v}`)
            .join('\r\n')
          socket.write(`${actionStr}\r\n\r\n`)
        }

        if (buffer.includes(`ActionID: ${actionId}`)) {
          socket.destroy()
          const parsed: Record<string, string> = {}
          for (const line of buffer.split('\r\n')) {
            const idx = line.indexOf(': ')
            if (idx > 0) {
              parsed[line.slice(0, idx).toLowerCase()] = line.slice(idx + 2)
            }
          }

          if (parsed.response === 'Error') {
            reject(new Error(parsed.message || 'AMI error'))
          } else {
            resolve(parsed)
          }
        }
      })

      socket.on('error', (err) => {
        socket.destroy()
        reject(new Error(`AMI connection error: ${err.message}`))
      })

      socket.on('timeout', () => {
        socket.destroy()
        reject(new Error('AMI connection timeout'))
      })
    })
  }

  private normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '')
    if (cleaned.startsWith('+90')) cleaned = `0${cleaned.slice(2)}`
    else if (cleaned.startsWith('90')) cleaned = `0${cleaned.slice(2)}`
    else if (!cleaned.startsWith('0') && cleaned.length === 10) cleaned = `0${cleaned}`
    return cleaned.slice(0, 15)
  }
}
