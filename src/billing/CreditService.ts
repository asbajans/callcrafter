import { getPayload } from 'payload'
import config from '@payload-config'
import type { PlanLimits } from './types'

export interface CreditCheckResult {
  allowed: boolean
  balance: number
  required: number
  remaining: number
}

export interface UsageLogInput {
  tenantId: number | string
  conversation?: string
  channel: 'voice' | 'whatsapp' | 'instagram' | 'web'
  service: 'stt' | 'tts' | 'llm'
  provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'self-hosted' | 'custom'
  model?: string
  duration?: number
  tokens?: number
  characters?: number
  audioSeconds?: number
  creditsUsed: number
  inputPreview?: string
  metadata?: Record<string, unknown>
}

const DEFAULT_CREDIT_COST_PER_SECOND = 0.01
const DEFAULT_CREDIT_COST_PER_TOKEN = 0.00001
const DEFAULT_CREDIT_COST_PER_CHAR = 0.001

export class CreditService {
  async getBalance(tenantId: number | string): Promise<number> {
    const payload = await getPayload({ config })
    const creditRecord = await payload.find({
      collection: 'tenant-credits' as any,
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })
    return creditRecord.docs[0]?.balance ?? 0
  }

  async checkCredits(tenantId: number | string, required: number): Promise<CreditCheckResult> {
    const payload = await getPayload({ config })
    const creditRecord = await payload.find({
      collection: 'tenant-credits' as any,
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })

    const balance = creditRecord.docs[0]?.balance ?? 0

    // Check monthly limit if set
    if (creditRecord.docs[0]?.monthlyLimit && creditRecord.docs[0].monthlyLimit > 0) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthlyUsage = await payload.find({
        collection: 'usage-logs' as any,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { createdAt: { greater_than: startOfMonth.toISOString() } },
          ],
        },
        limit: 0,
      })
      const monthlyTotal = monthlyUsage.totalDocs || 0
      if (monthlyTotal + required > creditRecord.docs[0].monthlyLimit) {
        return { allowed: false, balance, required, remaining: 0 }
      }
    }

    return {
      allowed: balance >= required,
      balance,
      required,
      remaining: Math.max(0, balance - required),
    }
  }

  async deductCredits(
    tenantId: number | string,
    amount: number,
    usageLog: UsageLogInput,
  ): Promise<boolean> {
    const payload = await getPayload({ config })

    const creditRecord = await payload.find({
      collection: 'tenant-credits' as any,
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })

    if (!creditRecord.docs[0]) return false
    const record = creditRecord.docs[0]
    const balanceBefore = record.balance ?? 0

    if (balanceBefore < amount) return false

    const balanceAfter = balanceBefore - amount

    // Deduct credits
    await payload.update({
      collection: 'tenant-credits' as any,
      id: record.id,
      data: {
        balance: balanceAfter,
        totalUsed: (record.totalUsed ?? 0) + amount,
      },
    })

    // Log usage
    await payload.create({
      collection: 'usage-logs' as any,
      data: {
        tenant: tenantId,
        conversation: usageLog.conversation,
        channel: usageLog.channel,
        service: usageLog.service,
        provider: usageLog.provider,
        model: usageLog.model,
        duration: usageLog.duration,
        tokens: usageLog.tokens,
        characters: usageLog.characters,
        audioSeconds: usageLog.audioSeconds,
        creditsUsed: amount,
        inputPreview: usageLog.inputPreview?.slice(0, 200),
        metadata: usageLog.metadata,
      },
    })

    // Create transaction record
    await payload.create({
      collection: 'credit-transactions' as any,
      data: {
        tenant: tenantId,
        type: 'usage',
        amount: -amount,
        balanceBefore,
        balanceAfter,
        source: 'usage',
        description: `${usageLog.service} - ${usageLog.channel}${usageLog.model ? ` (${usageLog.model})` : ''}`,
      },
    })

    return true
  }

  async addCredits(
    tenantId: number | string,
    amount: number,
    source: 'stripe' | 'admin' | 'system' = 'admin',
    options?: {
      description?: string
      expiresAt?: string
      stripePaymentIntentId?: string
      creditPackageId?: string
    },
  ): Promise<boolean> {
    const payload = await getPayload({ config })

    let creditRecord = await payload.find({
      collection: 'tenant-credits' as any,
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })

    const balanceBefore = creditRecord.docs[0]?.balance ?? 0
    const balanceAfter = balanceBefore + amount

    if (creditRecord.docs[0]) {
      await payload.update({
        collection: 'tenant-credits' as any,
        id: creditRecord.docs[0].id,
        data: {
          balance: balanceAfter,
          totalPurchased: (creditRecord.docs[0].totalPurchased ?? 0) + amount,
          lastTopUpAt: new Date().toISOString(),
          earliestExpiry: options?.expiresAt || creditRecord.docs[0].earliestExpiry,
        },
      })
    } else {
      await payload.create({
        collection: 'tenant-credits' as any,
        data: {
          tenant: tenantId,
          balance: amount,
          totalPurchased: amount,
          lastTopUpAt: new Date().toISOString(),
          earliestExpiry: options?.expiresAt,
        },
      })
    }

    await payload.create({
      collection: 'credit-transactions' as any,
      data: {
        tenant: tenantId,
        type: source === 'stripe' ? 'purchase' : 'manual_add',
        amount,
        balanceBefore,
        balanceAfter,
        source,
        description: options?.description || (source === 'stripe' ? 'Stripe purchase' : 'Admin added'),
        stripePaymentIntentId: options?.stripePaymentIntentId,
        expiresAt: options?.expiresAt,
        creditPackage: options?.creditPackageId,
      },
    })

    return true
  }

  async expireCredits(tenantId: number | string): Promise<number> {
    const payload = await getPayload({ config })

    const creditRecord = await payload.find({
      collection: 'tenant-credits' as any,
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { earliestExpiry: { less_than: new Date().toISOString() } },
          { balance: { greater_than: 0 } },
        ],
      },
      limit: 1,
    })

    if (!creditRecord.docs[0]) return 0

    const record = creditRecord.docs[0]
    const expiredAmount = record.balance

    await payload.update({
      collection: 'tenant-credits' as any,
      id: record.id,
      data: {
        balance: 0,
        totalExpired: (record.totalExpired ?? 0) + expiredAmount,
        earliestExpiry: null,
      },
    })

    await payload.create({
      collection: 'credit-transactions' as any,
      data: {
        tenant: tenantId,
        type: 'expired',
        amount: -expiredAmount,
        balanceBefore: expiredAmount,
        balanceAfter: 0,
        source: 'system',
        description: 'Credits expired (6 months)',
      },
    })

    return expiredAmount
  }

  async getMonthlyUsage(tenantId: number | string): Promise<{ total: number; byService: Record<string, number> }> {
    const payload = await getPayload({ config })
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const logs = await payload.find({
      collection: 'usage-logs' as any,
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { createdAt: { greater_than: startOfMonth.toISOString() } },
        ],
      },
      limit: 1000,
    })

    const byService: Record<string, number> = {}
    let total = 0
    for (const log of logs.docs) {
      const svc = (log as any).service || 'unknown'
      const credits = (log as any).creditsUsed || 0
      byService[svc] = (byService[svc] || 0) + credits
      total += credits
    }

    return { total, byService }
  }

  async syncPlanLimits(tenantId: number | string): Promise<void> {
    const payload = await getPayload({ config })

    const subs = await payload.find({
      collection: 'subscriptions',
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })

    if (!subs.docs[0]) return
    const sub = subs.docs[0] as any
    const planId = typeof sub.plan === 'object' ? sub.plan?.id : sub.plan
    if (!planId) return

    const plan = await payload.findByID({ collection: 'pricing-plans', id: planId })
    if (!plan) return

    const limits = (plan as any).limits as PlanLimits | null
    if (!limits) return

    if (limits.monthlyAiCredits > 0) {
      const creditsRecord = await payload.find({
        collection: 'tenant-credits' as any,
        where: { tenant: { equals: tenantId } },
        limit: 1,
      })

      if (creditsRecord.docs[0]) {
        await payload.update({
          collection: 'tenant-credits' as any,
          id: creditsRecord.docs[0].id,
          data: { monthlyLimit: limits.monthlyAiCredits },
        })
      }
    }
  }
}
