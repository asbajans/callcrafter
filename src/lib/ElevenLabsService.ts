const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'

interface AgentConfig {
  name: string
  conversation_config: {
    agent: {
      prompt: { prompt: string }
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
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
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

  async createKnowledgeBaseFromText(text: string, name?: string): Promise<{ id: string; name: string }> {
    return this.request('POST', '/convai/knowledge-base/text', { text, name })
  }

  async createKnowledgeBaseFromFile(fileBuffer: Buffer, fileName: string): Promise<{ id: string; name: string }> {
    const url = `${ELEVENLABS_API_BASE}/convai/knowledge-base/file`
    const boundary = `----FormBoundary${Date.now()}`
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`
    const footer = `\r\n--${boundary}--\r\n`
    const body = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      fileBuffer,
      Buffer.from(footer, 'utf-8'),
    ])

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ElevenLabs API error (${res.status}): ${text}`)
    }
    return res.json()
  }

  async listKnowledgeBaseDocuments(): Promise<any> {
    return this.request('GET', '/convai/knowledge-base')
  }

  async deleteKnowledgeBaseDocument(docId: string): Promise<void> {
    return this.request('DELETE', `/convai/knowledge-base/${docId}`)
  }

  async listPhoneNumbers(): Promise<any> {
    return this.request('GET', '/convai/phone-numbers')
  }

  async deletePhoneNumber(phoneNumberId: string): Promise<void> {
    return this.request('DELETE', `/convai/phone-numbers/${phoneNumberId}`)
  }

  async getPhoneNumber(phoneNumberId: string): Promise<any> {
    return this.request('GET', `/convai/phone-numbers/${phoneNumberId}`)
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
    knowledgeBaseDocs?: { type: string; id: string; name: string; usage_mode?: string }[]
    rag?: { enabled: boolean; embedding_model?: string; max_documents_length?: number; max_retrieved_rag_chunks_count?: number }
  }): AgentConfig {
    const promptObj: any = { prompt: params.systemPrompt }
    if (params.knowledgeBaseDocs?.length) {
      promptObj.knowledge_base = params.knowledgeBaseDocs.map(d => ({
        type: d.type || 'file',
        id: d.id,
        name: d.name,
        usage_mode: d.usage_mode || 'auto',
      }))
    }
    if (params.rag) {
      promptObj.rag = {
        enabled: params.rag.enabled,
        embedding_model: params.rag.embedding_model || 'qwen3_embedding_4b',
        max_documents_length: params.rag.max_documents_length || 50000,
        max_retrieved_rag_chunks_count: params.rag.max_retrieved_rag_chunks_count || 20,
      }
    }
    const config: AgentConfig = {
      name: params.name,
      conversation_config: {
        agent: {
          prompt: promptObj,
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
