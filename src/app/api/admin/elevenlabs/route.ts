import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ElevenLabsService } from '@/lib/ElevenLabsService'

const VOICE_ENGINE_LABELS: Record<string, string> = {
  'natural-tr-female': 'Doğal Türkçe Kadın',
  'professional-us-female': 'Profesyonel US Kadın',
  'natural-gb-female': 'Doğal İngiliz Kadın',
}

async function getCurrentUser() {
  const { cookies } = await import('next/headers')
  const { getUserIdFromToken } = await import('@/lib/auth')
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null
  const userId = await getUserIdFromToken(token)
  if (!userId) return null
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
  if (!user) return null
  return { id: user.id as number, email: user.email as string, role: user.role as string }
}

async function getElevenLabsService(): Promise<ElevenLabsService | null> {
  // First try env var
  const envKey = process.env.ELEVENLABS_API_KEY
  if (envKey) return new ElevenLabsService(envKey)

  // Fallback: look up from AiProviders collection
  try {
    const payload = await getPayload({ config })
    const providers = await payload.find({
      collection: 'ai-providers' as any,
      where: { name: { like: 'elevenlabs' } },
      limit: 1,
      depth: 0,
    })
    let provider = providers.docs[0] as any
    if (!provider?.apiKey) {
      const all = await payload.find({
        collection: 'ai-providers' as any,
        limit: 50,
        depth: 0,
      })
      provider = (all.docs as any[]).find((p: any) =>
        p.apiKey && typeof p.apiKey === 'string' && p.apiKey.startsWith('sk_')
      )
    }
    if (!provider?.apiKey) return null
    return new ElevenLabsService(provider.apiKey)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !['admin', 'super-admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'agents'
    const el = await getElevenLabsService()

    if (action === 'voices') {
      if (!el) return NextResponse.json({ voices: [] })
      try {
        const data = await el.listVoices()
        return NextResponse.json({ voices: data.voices || [] })
      } catch (err: any) {
        return NextResponse.json({ error: err.message, voices: [] })
      }
    }

    if (action === 'phone-numbers') {
      if (!el) return NextResponse.json({ phoneNumbers: [] })
      try {
        const data = await el.listPhoneNumbers()
        return NextResponse.json({ phoneNumbers: data.phone_numbers || [] })
      } catch (err: any) {
        return NextResponse.json({ error: err.message, phoneNumbers: [] })
      }
    }

    if (action === 'knowledge-base' || action === 'kb-docs') {
      if (!el) return NextResponse.json({ documents: [] })
      try {
        const data = await el.listKnowledgeBaseDocuments()
        return NextResponse.json({ documents: data.documents || [] })
      } catch (err: any) {
        return NextResponse.json({ error: err.message, documents: [] })
      }
    }

    if (action === 'elevenlabs-agents') {
      if (!el) return NextResponse.json({ elevenlabsAgents: [] })
      try {
        const data = await el.listAgents()
        return NextResponse.json({ elevenlabsAgents: data.agents || [] })
      } catch (err: any) {
        return NextResponse.json({ error: err.message, elevenlabsAgents: [] })
      }
    }

    if (action === 'user-info') {
      if (!el) return NextResponse.json({ error: 'ElevenLabs API anahtarı bulunamadı' }, { status: 400 })
      try {
        const data = await el.getUserInfo()
        return NextResponse.json({ userInfo: data })
      } catch (err: any) {
        return NextResponse.json({ error: err.message })
      }
    }

    // Default: return agents with ElevenLabs status
    const payload = await getPayload({ config })
    const agentsRes = await payload.find({
      collection: 'agents',
      limit: 100,
      sort: '-createdAt',
      depth: 0,
    })

    let elevenlabsAgentMap: Record<string, any> = {}
    if (el) {
      try {
        const data = await el.listAgents()
        if (data.agents) {
          for (const agent of data.agents) {
            elevenlabsAgentMap[agent.agent_id] = agent
          }
        }
      } catch {}
    }

    const agents = (agentsRes.docs || []).map((a: any) => {
      const elId = a.elevenlabsAgentId || null
      const elAgent = elId ? elevenlabsAgentMap[elId] : null
      return {
      id: a.id,
      name: a.name,
      language: a.language,
      voiceEngine: a.voiceEngine || 'elevenlabs',
      voiceTemplate: a.voiceTemplate || 'natural-tr-female',
      elevenlabsAgentId: elId,
      elevenlabsAgentName: elAgent?.name || null,
      elevenlabsVoice: a.elevenlabsVoice || a.voiceTemplate || null,
      elevenlabsPhoneNumberId: a.elevenlabsPhoneNumberId || null,
      status: a.status,
      createdAt: a.createdAt,
      }
    })

    return NextResponse.json({ agents })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !['admin', 'super-admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, agentId, elevenlabsVoiceId } = body
    const el = await getElevenLabsService()
    if (!el) {
      return NextResponse.json({ error: 'ElevenLabs API anahtarı bulunamadı. AiProviders koleksiyonunda ElevenLabs kaydını kontrol edin.' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    if (action === 'sync') {
      const agent = await payload.findByID({ collection: 'agents', id: agentId, depth: 1 })
      if (!agent) {
        return NextResponse.json({ error: 'Agent bulunamadı' }, { status: 404 })
      }

      const a = agent as any
      const tenantId = a.tenant?.id || a.tenant
      const tenantName = a.tenant?.name || `tenant-${tenantId}`
      const agentName = `${tenantName} - ${a.name}`
      const tags = [`tenant:${tenantId}`, `tenant:${tenantName}`]
      const voiceId = elevenlabsVoiceId || a.voiceTemplate || a.elevenlabsVoice || '21m00Tcm4TlvDq8ikWAM'
      const firstMsg = a.greetingMessage || 'Merhaba, size nasıl yardımcı olabilirim?'
      const lang = (a.language || 'tr').toLowerCase()
      const promptText = a.systemPrompt || 'Sen yardımsever bir AI asistanısın.'

      try {
        const promptObj: any = { prompt: promptText }

        const selectedKbIds: string[] = a.elevenlabsKbDocIds || []

        if (selectedKbIds.length > 0) {
          try {
            const allDocs = await el.listKnowledgeBaseDocuments()
            const allDocList: any[] = allDocs.documents || []
            const selectedDocs = allDocList.filter((d: any) => selectedKbIds.includes(d.id))
            if (selectedDocs.length > 0) {
              promptObj.knowledge_base = selectedDocs.map((d: any) => ({
                type: 'file',
                id: d.id,
                name: d.name || 'Document',
                usage_mode: 'auto',
              }))
            }
          } catch {} // silently skip KB docs if fetch fails
        }

        const config: any = {
          name: agentName,
          conversation_config: {
            agent: { prompt: promptObj, first_message: firstMsg, language: lang },
            tts: { voice_id: voiceId, model_id: a.elevenlabsModel || 'eleven_multilingual_v2' },
            turn: { turn_timeout: a.elevenlabsTurnTimeout || 10 },
          },
          tags,
        }

        let result: any
        if (a.elevenlabsAgentId) {
          await el.updateAgent(a.elevenlabsAgentId, config)
          result = { agent_id: a.elevenlabsAgentId }
          await payload.update({
            collection: 'agents', id: agentId,
            data: { elevenlabsVoice: voiceId, elevenlabsLanguage: lang } as any,
          })
        } else {
          result = await el.createAgent(config)
          await payload.update({
            collection: 'agents', id: agentId,
            data: {
              elevenlabsAgentId: result.agent_id, elevenlabsVoice: voiceId,
              elevenlabsLanguage: lang, voiceEngine: 'elevenlabs',
            } as any,
          })
        }

        return NextResponse.json({
          success: true,
          action: a.elevenlabsAgentId ? 'updated' : 'created',
          agentId: result.agent_id,
          voiceId,
          kbDocCount: selectedKbIds.length,
        })
      } catch (err: any) {
        return NextResponse.json({
          error: `ElevenLabs API hatası: ${err.message}`,
        }, { status: 502 })
      }
    }

    if (action === 'sync-training-docs') {
      const agent = await payload.findByID({ collection: 'agents', id: agentId, depth: 1 }) as any
      if (!agent) {
        return NextResponse.json({ error: 'Agent bulunamadı' }, { status: 404 })
      }

      const trainingDocs = await payload.find({
        collection: 'training-docs' as any,
        where: { agent: { equals: agentId } },
        limit: 50,
        depth: 1,
      })

      const results: any[] = []
      for (const doc of (trainingDocs.docs || [])) {
        const d = doc as any
        try {
          if (d.elevenlabsKbDocId) {
            results.push({ id: d.id, name: d.name, status: 'already_synced', kbDocId: d.elevenlabsKbDocId })
            continue
          }
          let textContent = d.name || 'Untitled'
          if (d.description) textContent += '\n\n' + d.description
          const kbResult = await el.createKnowledgeBaseFromText(textContent, d.name || 'Training Document')
          await payload.update({
            collection: 'training-docs' as any,
            id: d.id,
            data: { elevenlabsKbDocId: kbResult.id } as any,
          })
          results.push({ id: d.id, name: d.name, status: 'created', kbDocId: kbResult.id })
        } catch (err: any) {
          results.push({ id: d.id, name: d.name, status: 'error', error: err.message })
        }
      }

      return NextResponse.json({ success: true, results })
    }

    if (action === 'upload-doc') {
      const { text, name } = body
      if (!text) return NextResponse.json({ error: 'text gerekli' }, { status: 400 })
      try {
        const result = await el.createKnowledgeBaseFromText(text, name || 'Untitled')
        return NextResponse.json({ success: true, kbDocId: result.id, name: result.name })
      } catch (err: any) {
        return NextResponse.json({ error: `Belge yüklenemedi: ${err.message}` }, { status: 502 })
      }
    }

    if (action === 'sync-all-training-docs') {
      const allDocs = await payload.find({
        collection: 'training-docs' as any,
        limit: 200,
        depth: 0,
      })

      const results: any[] = []
      for (const doc of (allDocs.docs || [])) {
        const d = doc as any
        try {
          if (d.elevenlabsKbDocId) continue
          let textContent = d.name || 'Untitled'
          if (d.description) textContent += '\n\n' + d.description
          const kbResult = await el.createKnowledgeBaseFromText(textContent, d.name || 'Training Document')
          await payload.update({
            collection: 'training-docs' as any,
            id: d.id,
            data: { elevenlabsKbDocId: kbResult.id } as any,
          })
          results.push({ id: d.id, name: d.name, status: 'created', kbDocId: kbResult.id })
        } catch (err: any) {
          results.push({ id: d.id, name: d.name, status: 'error', error: err.message })
        }
      }

      return NextResponse.json({ success: true, total: allDocs.docs.length, created: results.length, results })
    }

    if (action === 'import-phone') {
      const { phoneNumber, twilioAccountSid, twilioAuthToken } = body
      if (!phoneNumber || !twilioAccountSid || !twilioAuthToken) {
        return NextResponse.json({ error: 'phoneNumber, twilioAccountSid, twilioAuthToken gerekli' }, { status: 400 })
      }
      try {
        const result = await el.importTwilioPhoneNumber(phoneNumber, twilioAccountSid, twilioAuthToken)
        return NextResponse.json({ success: true, phoneNumber: result })
      } catch (err: any) {
        return NextResponse.json({ error: `Telefon numarası içe aktarılamadı: ${err.message}` }, { status: 502 })
      }
    }

    if (action === 'link-phone') {
      const { phoneNumberId, elevenlabsAgentId: targetAgentId } = body
      if (!phoneNumberId || !targetAgentId) {
        return NextResponse.json({ error: 'phoneNumberId ve elevenlabsAgentId gerekli' }, { status: 400 })
      }
      try {
        await el.linkPhoneToAgent(phoneNumberId, targetAgentId)
        if (agentId) {
          await payload.update({
            collection: 'agents', id: agentId,
            data: { elevenlabsPhoneNumberId: phoneNumberId } as any,
          })
        }
        return NextResponse.json({ success: true })
      } catch (err: any) {
        return NextResponse.json({ error: `Telefon bağlanamadı: ${err.message}` }, { status: 502 })
      }
    }

    if (action === 'test-call') {
      const { phoneNumberId: callPhoneNumberId, toNumber } = body
      const agent = await payload.findByID({ collection: 'agents', id: agentId, depth: 0 }) as any
      if (!agent?.elevenlabsAgentId) {
        return NextResponse.json({ error: 'Agent ElevenLabs ile senkronize değil' }, { status: 400 })
      }
      const sourcePhoneNumberId = callPhoneNumberId || agent.elevenlabsPhoneNumberId
      if (!sourcePhoneNumberId) {
        return NextResponse.json({ error: 'Kaynak telefon numarası gerekli' }, { status: 400 })
      }
      if (!toNumber) {
        return NextResponse.json({ error: 'Hedef numara gerekli' }, { status: 400 })
      }
      try {
        const result = await el.createOutboundCall(
          agent.elevenlabsAgentId,
          sourcePhoneNumberId,
          toNumber,
          { firstMessage: agent.greetingMessage, language: agent.elevenlabsLanguage || 'tr' },
        )
        return NextResponse.json({ success: true, call: result })
      } catch (err: any) {
        return NextResponse.json({ error: `Çağrı başlatılamadı: ${err.message}` }, { status: 502 })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !['admin', 'super-admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action, agentId, documentId } = body
  const el = await getElevenLabsService()
  if (!el) {
    return NextResponse.json({ error: 'ElevenLabs API anahtarı bulunamadı' }, { status: 400 })
  }

  if (action === 'delete-kb-doc') {
    if (!documentId) return NextResponse.json({ error: 'documentId gerekli' }, { status: 400 })
    try {
      await el.deleteKnowledgeBaseDocument(documentId)
      return NextResponse.json({ success: true })
    } catch (err: any) {
      return NextResponse.json({ error: `KB belgesi silinemedi: ${err.message}` }, { status: 500 })
    }
  }

  if (!agentId) {
    return NextResponse.json({ error: 'agentId gerekli' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const agent = await payload.findByID({ collection: 'agents', id: agentId, depth: 0 }) as any
  if (!agent) {
    return NextResponse.json({ error: 'Agent bulunamadı' }, { status: 404 })
  }

  if (!agent.elevenlabsAgentId) {
    return NextResponse.json({ error: 'Bu agent ElevenLabs ile senkronize değil' }, { status: 400 })
  }

  try {
    await el.deleteAgent(agent.elevenlabsAgentId)
  } catch (err: any) {
    return NextResponse.json({ error: `ElevenLabs agent silinemedi: ${err.message}` }, { status: 500 })
  }

  await payload.update({
    collection: 'agents',
    id: agentId,
    data: {
      elevenlabsAgentId: null,
      elevenlabsPhoneNumberId: null,
    } as any,
  })

  return NextResponse.json({ success: true, action: 'deleted' })
}
