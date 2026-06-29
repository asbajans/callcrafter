import { getPayload } from 'payload'
import config from '../../payload.config'

export interface ProviderConfig {
  providerType: string
  apiKey: string
  baseUrl?: string
  model: string
}

const modelMap: Record<string, string> = {
  'gpt-4': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'claude-3-opus': 'anthropic',
  'claude-3-sonnet': 'anthropic',
  'claude-3-haiku': 'anthropic',
}

function getProviderId(agent: any): number | null {
  if (!agent.provider) return null
  if (typeof agent.provider === 'object') return (agent.provider as any).id
  return agent.provider
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
      return {
        providerType: prov.providerType || 'openai',
        apiKey: prov.apiKey,
        baseUrl: prov.baseUrl || undefined,
        model,
      }
    }
  }

  // Fallback: env vars
  const fallbackProvider = modelMap[model] || 'openai'
  const envKey = fallbackProvider === 'anthropic' ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY

  return {
    providerType: fallbackProvider,
    apiKey: envKey || '',
    model,
  }
}
