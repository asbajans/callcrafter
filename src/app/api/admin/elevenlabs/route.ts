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
        const data = await el.listAgents()
        return NextResponse.json({ phoneNumbers: data.phone_numbers || [] })
      } catch (err: any) {
        return NextResponse.json({ error: err.message, phoneNumbers: [] })
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
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/elevenlabs`
      : `https://callcrafter.com.tr/api/webhooks/elevenlabs`

    const el = await getElevenLabsService()
    if (!el) {
      return NextResponse.json({ error: 'ElevenLabs API anahtarı bulunamadı. AiProviders koleksiyonunda ElevenLabs kaydını kontrol edin.' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    if (action === 'sync') {
      const agent = await payload.findByID({ collection: 'agents', id: agentId, depth: 0 })
      if (!agent) {
        return NextResponse.json({ error: 'Agent bulunamadı' }, { status: 404 })
      }

      const a = agent as any
      const voiceId = elevenlabsVoiceId || a.voiceTemplate || a.elevenlabsVoice || '21m00Tcm4TlvDq8ikWAM'
      const firstMsg = a.greetingMessage || 'Merhaba, size nasıl yardımcı olabilirim?'
      const lang = (a.language || 'tr').toLowerCase()
      const prompt = a.systemPrompt || 'Sen yardımsever bir AI asistanısın.'

      try {
        if (a.elevenlabsAgentId) {
          await el.updateAgent(a.elevenlabsAgentId, {
            name: a.name,
            conversation_config: {
              agent: { prompt, first_message: firstMsg, language: lang },
              tts: { voice_id: voiceId, model_id: a.elevenlabsModel || 'eleven_multilingual_v2' },
              turn: { turn_timeout: a.elevenlabsTurnTimeout || 10 },
              webhook: { url: webhookUrl },
            },
          })

          await payload.update({
            collection: 'agents', id: agentId,
            data: { elevenlabsVoice: voiceId, elevenlabsLanguage: lang } as any,
          })

          return NextResponse.json({ success: true, action: 'updated', agentId: a.elevenlabsAgentId, voiceId })
        } else {
          const result = await el.createAgent({
            name: a.name,
            conversation_config: {
              agent: { prompt, first_message: firstMsg, language: lang },
              tts: { voice_id: voiceId, model_id: a.elevenlabsModel || 'eleven_multilingual_v2' },
              turn: { turn_timeout: a.elevenlabsTurnTimeout || 10 },
              webhook: { url: webhookUrl },
            },
          })

          await payload.update({
            collection: 'agents', id: agentId,
            data: {
              elevenlabsAgentId: result.agent_id, elevenlabsVoice: voiceId,
              elevenlabsLanguage: lang, voiceEngine: 'elevenlabs',
            } as any,
          })

          return NextResponse.json({ success: true, action: 'created', agentId: result.agent_id, voiceId })
        }
      } catch (err: any) {
        return NextResponse.json({
          error: `ElevenLabs API hatası: ${err.message}`,
        }, { status: 502 })
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
  const { agentId } = body

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

  const el = await getElevenLabsService()
  if (!el) {
    return NextResponse.json({ error: 'ElevenLabs API anahtarı bulunamadı' }, { status: 400 })
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
