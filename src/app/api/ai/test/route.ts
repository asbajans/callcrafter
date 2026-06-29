import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../../payload.config'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { checkCreditBalance, deductAICost } from '@/billing/creditMiddleware'

function getTenantId(agent: any): number | null {
  if (!agent.tenant) return null
  if (typeof agent.tenant === 'object') return agent.tenant.id
  return agent.tenant
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, message, history } = await req.json()
    if (!agentId || !message) {
      return NextResponse.json({ error: 'agentId and message are required' }, { status: 400 })
    }

    const cookieStore = req.cookies
    const token = cookieStore.get('payload-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })

    let userId: string
    try {
      const { user } = await payload.auth({ headers: new Headers({ Cookie: `payload-token=${token}` }) })
      if (!user) throw new Error('Invalid token')
      userId = String(user.id)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agents = await payload.find({
      collection: 'agents',
      where: { id: { equals: agentId } },
      depth: 2,
    })
    if (agents.docs.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agent = agents.docs[0]
    const tenantId = getTenantId(agent)
    if (!tenantId) {
      return NextResponse.json({ error: 'Agent has no tenant' }, { status: 400 })
    }

    const creditCheck = await checkCreditBalance(tenantId, 3)
    if (!creditCheck.ok) {
      return NextResponse.json({ error: creditCheck.error }, { status: 402 })
    }

    const model = agent.model || 'gpt-4o'
    const systemPrompt = agent.systemPrompt || 'You are a helpful assistant.'
    const temperature = agent.temperature ?? 0.7
    const maxTokens = agent.maxTokens ?? 2048

    const provider = (agent as any).provider
    let providerType = 'openai'
    let apiKey = ''
    let baseUrl: string | undefined

    if (provider && typeof provider === 'object') {
      const p = provider as any
      providerType = p.providerType || 'openai'
      const storedKey = (p as any).apiKey
      if (storedKey && typeof storedKey === 'string' && storedKey.startsWith('sk-')) {
        apiKey = storedKey
      }
    }

    if (!apiKey) {
      if (providerType === 'anthropic') {
        apiKey = process.env.ANTHROPIC_API_KEY || ''
      } else if (providerType === 'openrouter') {
        baseUrl = 'https://openrouter.ai/api/v1'
        apiKey = process.env.OPENROUTER_API_KEY || ''
      } else {
        apiKey = process.env.OPENAI_API_KEY || ''
      }
    }

    if (!apiKey) {
      const keyName = providerType === 'anthropic' ? 'ANTHROPIC_API_KEY'
        : providerType === 'openrouter' ? 'OPENROUTER_API_KEY'
        : 'OPENAI_API_KEY'
      return NextResponse.json({
        error: `${keyName} environment variable is not configured. Add it in Portainer to use AI test.`,
      }, { status: 500 })
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

    const fullSystemPrompt = trainingContext
      ? `${systemPrompt}\n\n## Training Context\n${trainingContext}`
      : systemPrompt

    const conversationHistory = (history || []).map((h: any) => ({
      role: h.role,
      content: h.content,
    }))

    let result: string

    if (providerType === 'anthropic') {
      const anthropic = new Anthropic({ apiKey })
      const messages: Anthropic.MessageParam[] = [
        ...conversationHistory,
        { role: 'user', content: message },
      ]
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: fullSystemPrompt,
        messages,
      })
      result = response.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
    } else {
      const openai = new OpenAI({ apiKey, baseURL: baseUrl })
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: fullSystemPrompt },
        ...conversationHistory,
        { role: 'user', content: message },
      ]
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      })
      result = response.choices?.[0]?.message?.content || ''
    }

    await deductAICost(tenantId, {
      channel: 'voice',
      service: 'llm',
      provider: providerType,
      model,
      inputTokens: Math.ceil(message.length / 4),
      outputTokens: Math.ceil(result.length / 4),
    })

    return NextResponse.json({ response: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
