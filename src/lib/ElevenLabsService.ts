const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'

interface AgentConfig {
  name: string
  conversation_config: {
    agent: {
      prompt: string
      first_message: string
      language: string
    }
    tts: {
      voice_id: string
      model_id: string
    }
    turn: {
      turn_timeout: number
    }
    language_presets?: Record<string, any>
  }
  platform_settings?: Record<string, any>
  tags?: string[]
}

export class ElevenLabsService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async request(method: string, path: string, body?: any) {
    const url = `${ELEVENLABS_API_BASE}${path}`
    const headers: Record<string, string> = {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json',
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ElevenLabs API error (${res.status}): ${text}`)
    }
    return res.json()
  }

  async createAgent(config: AgentConfig): Promise<{ agent_id: string }> {
    return this.request('POST', '/convai/agents/create', config)
  }

  async updateAgent(agentId: string, config: Partial<AgentConfig>) {
    return this.request('PATCH', `/convai/agents/${agentId}`, config)
  }

  async deleteAgent(agentId: string) {
    return this.request('DELETE', `/convai/agents/${agentId}`)
  }

  async getAgent(agentId: string): Promise<any> {
    return this.request('GET', `/convai/agents/${agentId}`)
  }

  async listAgents(): Promise<any> {
    return this.request('GET', '/convai/agents')
  }

  async listVoices(): Promise<any> {
    return this.request('GET', '/voices')
  }

  async importTwilioPhoneNumber(
    phoneNumber: string,
    twilioAccountSid: string,
    twilioAuthToken: string,
  ): Promise<any> {
    return this.request('POST', '/convai/phone-numbers/create', {
      phone_number: phoneNumber,
      twilio_account_sid: twilioAccountSid,
      twilio_auth_token: twilioAuthToken,
      provider: 'twilio',
    })
  }

  async linkPhoneToAgent(phoneNumberId: string, agentId: string): Promise<any> {
    return this.request('PATCH', `/convai/phone-numbers/${phoneNumberId}`, {
      agent_id: agentId,
    })
  }

  async getUserInfo(): Promise<any> {
    return this.request('GET', '/user')
  }

  async createOutboundCall(
    agentId: string,
    agentPhoneNumberId: string,
    toNumber: string,
    overrides?: {
      firstMessage?: string
      language?: string
      prompt?: string
      dynamicVariables?: Record<string, string>
    },
  ): Promise<any> {
    return this.request('POST', '/convai/twilio/outbound-call', {
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: toNumber,
      conversation_initiation_client_data: overrides
        ? {
            conversation_config_override: {
              agent: {
                prompt: overrides.prompt,
                first_message: overrides.firstMessage,
                language: overrides.language,
              },
            },
            dynamic_variables: overrides.dynamicVariables,
          }
        : undefined,
    })
  }

  buildAgentConfig(params: {
    name: string
    systemPrompt: string
    firstMessage: string
    language: string
    voiceId: string
    ttsModel?: string
    turnTimeout?: number
    temperature?: number
    webhookUrl?: string
    webhookSecret?: string
    tags?: string[]
  }): AgentConfig {
    const config: AgentConfig = {
      name: params.name,
      conversation_config: {
        agent: {
          prompt: params.systemPrompt,
          first_message: params.firstMessage,
          language: params.language,
        },
        tts: {
          voice_id: params.voiceId,
          model_id: params.ttsModel || 'eleven_multilingual_v2',
        },
        turn: {
          turn_timeout: params.turnTimeout || 10,
        },
      },
    }
    if (params.tags?.length) {
      config.tags = params.tags
    }
    return config
  }
}
