import { getPayload } from 'payload'
import config from '../../payload.config'

export interface ProviderConfig {
  providerType: string
  apiKey: string
  baseUrl?: string
  model: string
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434/v1',
}

function getProviderId(agent: any): number | null {
  if (!agent.provider) return null
  if (typeof agent.provider === 'object') return (agent.provider as any).id
  return agent.provider
}

function detectProviderType(apiKey: string, declaredType: string): string {
  if (apiKey.startsWith('sk-or-v1')) return 'openrouter'
  if (apiKey.startsWith('sk-ant-')) return 'anthropic'
  return declaredType
}

export async function resolveProviderConfig(agent: any): Promise<ProviderConfig> {
  const model = agent.model || 'gpt-4o'
  const providerId = getProviderId(agent)

  if (providerId) {
    const payload = await getPayload({ config })
    const providers = await payload.find({
      collection: 'ai-providers' as any,
      where: { id: { equals: providerId } },
      depth: 0,
      overrideAccess: true,
    })
    const prov = providers.docs[0] as any
    if (prov && prov.apiKey) {
      const providerType = detectProviderType(prov.apiKey, prov.providerType || 'openai')
      const baseUrl = prov.baseUrl || DEFAULT_BASE_URLS[providerType] || undefined
      return { providerType, apiKey: prov.apiKey, baseUrl, model }
    }
  }

  // Fallback: env vars
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || ''
  const providerType = detectProviderType(apiKey, 'openai')
  const baseUrl = DEFAULT_BASE_URLS[providerType] || undefined

  return { providerType, apiKey, baseUrl, model }
}
