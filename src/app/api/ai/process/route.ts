import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../../payload.config'
import { AgentOrchestrator } from '@/ai/orchestrator/AgentOrchestrator'
import { RateLimiter } from '@/lib/rate-limiter'
import { aiLogger } from '@/lib/logger'

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
      aiLogger.warn('Unauthorized AI process attempt', { ip: req.headers.get('x-forwarded-for') || 'unknown' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transcript, callSid, from, to, conversationHistory } = await req.json()

    if (!transcript || !callSid || !to) {
      aiLogger.warn('Missing required fields for AI process', { callSid, hasFrom: !!from, hasTo: !!to })
      return NextResponse.json({ error: 'transcript, callSid, and to are required' }, { status: 400 })
    }

    aiLogger.info('Processing AI request', { callSid, transcriptLength: transcript.length })

    const payload = await getPayload({ config })

    const phoneNumbers = await payload.find({
      collection: 'phone-numbers',
      where: { number: { equals: to } },
      depth: 2,
    })

    if (phoneNumbers.docs.length === 0) {
      aiLogger.warn('Phone number not found', { to })
      return NextResponse.json({ error: 'Phone number not found' }, { status: 404 })
    }

    const phoneNumber = phoneNumbers.docs[0]
    const agent = phoneNumber.forwardTo as any

    if (!agent) {
      aiLogger.warn('No agent configured for number', { to })
      return NextResponse.json({ error: 'No agent configured for this number' }, { status: 404 })
    }

    const voice = agent.voice as any
    const tenantId = typeof agent.tenant === 'object' ? agent.tenant.id : agent.tenant

    const rateLimiter = new RateLimiter()
    const rateCheck = await rateLimiter.checkLimit(
      tenantId || 'default',
      agent?.id || 'system',
      100,
      60_000,
    )

    if (!rateCheck.allowed) {
      aiLogger.warn('Rate limit exceeded for AI process', { tenantId, agentId: agent.id })
      return NextResponse.json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateCheck.reset - Date.now()) / 1000),
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
          'X-RateLimit-Reset': String(rateCheck.reset),
        },
      })
    }

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

    aiLogger.info('AI orchestrator processing', { callSid, agentId: agent.id, model: agent.model })

    const result = await orchestrator.process({
      text: transcript,
      context: {
        agentId: agent.id,
        tenantId,
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
          tenant: tenantId,
          agent: agent.id,
          channel: 'voice',
          externalId: callSid,
          contact: { from, to },
          status: 'active',
          startTime: new Date().toISOString(),
        },
      })
      conversationId = newConversation.id as number
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

    aiLogger.info('AI process completed successfully', { callSid, responseLength: result.content.length })

    return NextResponse.json({
      response: result.content,
      voiceId: voice?.providerVoiceId || '',
      voiceSettings: voice?.settings || { stability: 0.5, similarityBoost: 0.75 },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    aiLogger.error('AI process failed', error instanceof Error ? error : undefined, { error: message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}