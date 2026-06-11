import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../../payload.config'
import { InstagramAdapter } from '@/channels/instagram/InstagramAdapter'
import { AgentOrchestrator } from '@/ai/orchestrator/AgentOrchestrator'

const modelMap: Record<string, { provider: 'openai' | 'anthropic'; model: string }> = {
  'gpt-4': { provider: 'openai', model: 'gpt-4' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
  'claude-3-opus': { provider: 'anthropic', model: 'claude-3-opus-latest' },
  'claude-3-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
  'claude-3-haiku': { provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
}

function getInstagramAdapter(): InstagramAdapter {
  return new InstagramAdapter({
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    igUserId: process.env.INSTAGRAM_IG_USER_ID || '',
    appSecret: process.env.INSTAGRAM_APP_SECRET || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode') || ''
  const token = searchParams.get('hub.verify_token') || ''
  const challenge = searchParams.get('hub.challenge') || ''

  const adapter = getInstagramAdapter()
  const result = adapter.verifyWebhook(mode, token, challenge)

  if (result) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const adapter = getInstagramAdapter()
    const messages = adapter.handleWebhook(body)

    if (messages.length === 0) {
      return NextResponse.json({ status: 'ok' })
    }

    const payload = await getPayload({ config })

    for (const msg of messages) {
      if (!msg.text) continue

      const agents = await payload.find({
        collection: 'agents',
        where: {
          channels: { contains: 'instagram' },
          status: { equals: 'active' },
        },
        depth: 2,
      })

      if (agents.docs.length === 0) {
        await adapter.sendText(msg.from, 'No active agent configured.')
        continue
      }

      const agent = agents.docs[0]
      const voice = agent.voice as any

      let trainingContext = ''
      if (agent.trainingDocs && agent.trainingDocs.length > 0) {
        const trainingDocIds = agent.trainingDocs.map((d: any) =>
          typeof d === 'object' ? d.id : d
        )
        const trainingDocs = await payload.find({
          collection: 'training-docs',
          where: { id: { in: trainingDocIds.join(',') } },
        })
        trainingContext = trainingDocs.docs.map((d: any) => d.content).join('\n\n').slice(0, 10000)
      }

      const modelConfig = modelMap[agent.model as string] || { provider: 'openai', model: 'gpt-4o' }
      const apiKeyForProvider =
        modelConfig.provider === 'openai'
          ? process.env.OPENAI_API_KEY!
          : process.env.ANTHROPIC_API_KEY!

      const orchestrator = new AgentOrchestrator({
        provider: modelConfig.provider,
        apiKey: apiKeyForProvider,
        model: modelConfig.model,
      })

      const existingConversations = await payload.find({
        collection: 'conversations',
        where: {
          and: [
            { externalId: { equals: `ig_${msg.from}` } },
            { status: { equals: 'active' } },
          ],
        },
        depth: 0,
      })

      let conversationId: number

      if (existingConversations.docs.length === 0) {
        const newConversation = await payload.create({
          collection: 'conversations',
          data: {
            tenant: typeof agent.tenant === 'object' ? agent.tenant.id : agent.tenant,
            agent: agent.id,
            channel: 'instagram',
            externalId: `ig_${msg.from}`,
            contact: { igId: msg.from },
            status: 'active',
            startTime: new Date().toISOString(),
          },
        })
        conversationId = newConversation.id
      } else {
        conversationId = existingConversations.docs[0].id as number
      }

      const now = new Date().toISOString()

      await payload.create({
        collection: 'messages',
        data: {
          conversation: conversationId,
          role: 'user',
          content: msg.text,
          timestamp: now,
          metadata: { igMessageId: msg.id, channel: 'instagram' },
        },
      })

      const result = await orchestrator.process({
        text: msg.text,
        context: {
          agentId: String(agent.id),
          tenantId: typeof agent.tenant === 'object' ? String(agent.tenant.id) : String(agent.tenant),
          systemPrompt: agent.systemPrompt,
          conversationHistory: [],
          trainingContext,
          channel: 'instagram',
          tools: (agent.tools || []) as any,
        },
        channel: 'instagram',
      })

      await adapter.sendText(msg.from, result.content)

      await payload.create({
        collection: 'messages',
        data: {
          conversation: conversationId,
          role: 'assistant',
          content: result.content,
          timestamp: now,
          metadata: { channel: 'instagram' },
        },
      })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Instagram webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
