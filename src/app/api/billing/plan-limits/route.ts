import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { PlanLimits, DEFAULT_TRIAL_LIMITS } from '@/billing/types'

async function getCurrentTenantId(): Promise<number | null> {
  try {
    const { cookies } = await import('next/headers')
    const { getUserIdFromToken } = await import('@/lib/auth')
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value
    if (!token) return null
    const userId = await getUserIdFromToken(token)
    if (!userId) return null
    const payload = await getPayload({ config })
    const user = await payload.findByID({ collection: 'users', id: userId, depth: 1 })
    if (!user) return null
    const userData = user as any
    if (userData.tenant) {
      return typeof userData.tenant === 'object' ? userData.tenant.id : userData.tenant
    }
    return null
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) {
      return NextResponse.json(DEFAULT_TRIAL_LIMITS)
    }

    const payload = await getPayload({ config })

    // Find active subscription
    const subs = await payload.find({
      collection: 'subscriptions',
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })

    if (!subs.docs[0]) {
      return NextResponse.json(DEFAULT_TRIAL_LIMITS)
    }

    const sub = subs.docs[0] as any
    const planId = typeof sub.plan === 'object' ? sub.plan?.id : sub.plan

    if (!planId) {
      return NextResponse.json(DEFAULT_TRIAL_LIMITS)
    }

    const plan = await payload.findByID({
      collection: 'pricing-plans',
      id: planId,
    })

    if (!plan) {
      return NextResponse.json(DEFAULT_TRIAL_LIMITS)
    }

    const limits = (plan as any).limits as PlanLimits | null
    return NextResponse.json(limits || DEFAULT_TRIAL_LIMITS)
  } catch {
    return NextResponse.json(DEFAULT_TRIAL_LIMITS)
  }
}
