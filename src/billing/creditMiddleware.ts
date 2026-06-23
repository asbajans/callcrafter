import { CreditService } from './CreditService'

const service = new CreditService()

export async function checkCreditBalance(
  tenantId: number | string,
  estimatedCost: number = 1,
): Promise<{ ok: boolean; balance: number; error?: string }> {
  const balance = await service.getBalance(tenantId)
  if (balance < estimatedCost) {
    return {
      ok: false,
      balance,
      error: `Yetersiz bakiye. Mevcut: ${balance} kredi, gerekli: ${estimatedCost} kredi`,
    }
  }
  return { ok: true, balance }
}

export async function deductAICost(
  tenantId: number | string,
  params: {
    conversation?: string
    channel: 'voice' | 'whatsapp' | 'instagram' | 'web'
    service: 'stt' | 'tts' | 'llm'
    provider: string
    model?: string
    inputTokens?: number
    outputTokens?: number
    duration?: number
    audioSeconds?: number
  },
): Promise<number> {
  const { inputTokens, outputTokens, duration, audioSeconds } = params

  let cost = 0

  if (params.service === 'llm') {
    const inputChars = inputTokens ? inputTokens * 4 : 0
    const outputChars = outputTokens ? outputTokens * 4 : 0
    const totalChars = inputChars + outputChars
    cost = Math.max(1, Math.ceil(totalChars * 0.001))
  } else if (params.service === 'stt') {
    const seconds = audioSeconds || duration || 10
    cost = Math.max(1, Math.ceil(seconds * 0.01))
  } else if (params.service === 'tts') {
    const seconds = audioSeconds || duration || 10
    cost = Math.max(1, Math.ceil(seconds * 0.02))
  }

  const success = await service.deductCredits(tenantId, cost, {
    tenantId,
    conversation: params.conversation,
    channel: params.channel,
    service: params.service,
    provider: params.provider as any,
    model: params.model,
    duration: params.duration,
    creditsUsed: cost,
  })

  return success ? cost : 0
}
