import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../../payload.config'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { agentId, message, history } = await req.json()

    if (!agentId || !message) {
      return NextResponse.json({ error: 'agentId and message are required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const agents = await payload.find({
      collection: 'agents',
      where: { id: { equals: agentId } },
      depth: 2,
    })

    if (agents.docs.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agent = agents.docs[0]

    const model = agent.model || 'gpt-4o'
    const systemPrompt = agent.systemPrompt || 'You are a helpful assistant.'
    const temperature = agent.temperature ?? 0.7
    const maxTokens = agent.maxTokens ?? 2048

    const provider = (agent as any).provider
    let providerType = 'openai'
    let apiKey = process.env.OPENAI_API_KEY || ''

    if (provider && typeof provider === 'object') {
      const p = provider as any
      providerType = p.providerType || 'openai'
      if (providerType === 'anthropic') {
        apiKey = process.env.ANTHROPIC_API_KEY || ''
      } else if (providerType === 'openrouter') {
        apiKey = process.env.OPENROUTER_API_KEY || apiKey
      }
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
      const openai = new OpenAI({
        apiKey,
        baseURL: providerType === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined,
      })
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

    return NextResponse.json({ response: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
