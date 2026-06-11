import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../../payload.config'
import { AgentOrchestrator } from '@/ai/orchestrator/AgentOrchestrator'

const modelMap: Record<string, { provider: 'openai' | 'anthropic'; model: string }> = {
  'gpt-4': { provider: 'openai', model: 'gpt-4' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
  'claude-3-opus': { provider: 'anthropic', model: 'claude-3-opus-latest' },
  'claude-3-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
  'claude-3-haiku': { provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transcript, callSid, from, to, conversationHistory } = await req.json()

    if (!transcript || !callSid || !to) {
      return NextResponse.json({ error: 'transcript, callSid, and to are required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const phoneNumbers = await payload.find({
      collection: 'phone-numbers',
      where: { number: { equals: to } },
      depth: 2,
    })

    if (phoneNumbers.docs.length === 0) {
      return NextResponse.json({ error: 'Phone number not found' }, { status: 404 })
    }

    const phoneNumber = phoneNumbers.docs[0]
    const agent = phoneNumber.forwardTo as any

    if (!agent) {
      return NextResponse.json({ error: 'No agent configured for this number' }, { status: 404 })
    }

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

    const modelConfig = modelMap[agent.model] || { provider: 'openai', model: 'gpt-4o' }
    const apiKeyForProvider =
      modelConfig.provider === 'openai'
        ? process.env.OPENAI_API_KEY!
        : process.env.ANTHROPIC_API_KEY!

    const orchestrator = new AgentOrchestrator({
      provider: modelConfig.provider,
      apiKey: apiKeyForProvider,
      model: modelConfig.model,
    })

    const result = await orchestrator.process({
      text: transcript,
      context: {
        agentId: agent.id,
        tenantId: typeof agent.tenant === 'object' ? agent.tenant.id : agent.tenant,
        systemPrompt: agent.systemPrompt,
        conversationHistory: conversationHistory || [],
        trainingContext,
        channel: 'voice',
        tools: agent.tools || [],
      },
      channel: 'voice',
    })

    const existingConversations = await payload.find({
      collection: 'conversations',
      where: { externalId: { equals: callSid } },
      depth: 0,
    })

    let conversationId: number

    if (existingConversations.docs.length === 0) {
      const newConversation = await payload.create({
        collection: 'conversations',
        data: {
          tenant: typeof agent.tenant === 'object' ? agent.tenant.id : agent.tenant,
          agent: agent.id,
          channel: 'voice',
          externalId: callSid,
          contact: { from, to },
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
        content: transcript,
        timestamp: now,
        metadata: { callSid },
      },
    })

    await payload.create({
      collection: 'messages',
      data: {
        conversation: conversationId,
        role: 'assistant',
        content: result.content,
        timestamp: now,
        metadata: { callSid },
      },
    })

    return NextResponse.json({
      response: result.content,
      voiceId: voice?.providerVoiceId || '',
      voiceSettings: voice?.settings || { stability: 0.5, similarityBoost: 0.75 },
    })
  } catch (error) {
    console.error('AI process error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
