import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../../payload.config'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { checkCreditBalance, deductAICost } from '@/billing/creditMiddleware'
import { resolveProviderConfig } from '@/lib/resolveProvider'

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

    try {
      const { user } = await payload.auth({ headers: new Headers({ Cookie: `payload-token=${token}` }) })
      if (!user) throw new Error('Invalid token')
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agents = await payload.find({
      collection: 'agents',
      where: { id: { equals: agentId } },
      depth: 1,
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

    const providerConfig = await resolveProviderConfig(agent)
    if (!providerConfig.apiKey) {
      return NextResponse.json({
        error: `AI Provider "${providerConfig.providerType}" için API anahtarı tanımlanmamış. Admin panelden AI Provider kaydını düzenleyin.`,
      }, { status: 500 })
    }

    const systemPrompt = agent.systemPrompt || 'You are a helpful assistant.'
    const temperature = agent.temperature ?? 0.7
    const maxTokens = agent.maxTokens ?? 2048

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

    const MAX_RETRIES = 2
    let result: string
    let lastError: any

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (providerConfig.providerType === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: providerConfig.apiKey })
          const messages: Anthropic.MessageParam[] = [
            ...conversationHistory,
            { role: 'user', content: message },
          ]
          const response = await anthropic.messages.create({
            model: providerConfig.model,
            max_tokens: maxTokens,
            temperature,
            system: fullSystemPrompt,
            messages,
          })
          result = response.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
        } else {
          const openai = new OpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
          const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory,
            { role: 'user', content: message },
          ]
          const isNewModel = providerConfig.model.startsWith('gpt-5') || providerConfig.model.startsWith('o')
          const response = await openai.chat.completions.create({
            model: providerConfig.model,
            messages,
            temperature,
            ...(isNewModel ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
          })
          result = response.choices?.[0]?.message?.content || ''
        }
        lastError = null
        break
      } catch (err: any) {
        lastError = err
        const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'))
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 2000
          console.warn(`Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${delay}ms...`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        break
      }
    }

    if (lastError) {
      const isRateLimit = lastError.status === 429 || (lastError.message && lastError.message.includes('429'))
      if (isRateLimit) {
        const message = providerConfig.providerType === 'openrouter'
          ? 'OpenRouter ücretsiz model kotası doldu. Lütfen Admin > AI Providers sayfasından farklı bir API anahtarı ekleyin veya bekleyin.'
          : 'AI servisi çok fazla istek aldı. Lütfen birkaç saniye bekleyip tekrar deneyin.'
        return NextResponse.json({ error: message }, { status: 429 })
      }
      throw lastError
    }

    await deductAICost(tenantId, {
      channel: 'voice',
      service: 'llm',
      provider: providerConfig.providerType,
      model: providerConfig.model,
      inputTokens: Math.ceil(message.length / 4),
      outputTokens: Math.ceil(result!.length / 4),
    })

    return NextResponse.json({ response: result! })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('/api/ai/test error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
