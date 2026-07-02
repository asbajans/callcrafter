import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { StripeService } from '@/billing/StripeService'

async function getCurrentTenantUser(): Promise<{ tenantId: number; userId: number; email: string } | null> {
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
      const tenantId = typeof userData.tenant === 'object' ? userData.tenant.id : userData.tenant
      return { tenantId, userId, email: userData.email || '' }
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const { planId, successUrl, cancelUrl } = await req.json()
    if (!planId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const currentUser = await getCurrentTenantUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const plan = await payload.findByID({
      collection: 'pricing-plans' as any,
      id: planId,
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const planData = plan as any

    // Free/trial plans don't need Stripe
    if (planData.price === 0 || planData.price <= 0) {
      // Activate the plan directly
      const existing = await payload.find({
        collection: 'subscriptions',
        where: { tenant: { equals: currentUser.tenantId } },
      })

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'subscriptions',
          id: existing.docs[0].id,
          data: {
            plan: planId,
            status: 'active',
            currentPeriodStart: new Date().toISOString(),
          },
        })
      } else {
        await payload.create({
          collection: 'subscriptions',
          data: {
            tenant: currentUser.tenantId,
            plan: planId,
            status: 'active',
            currentPeriodStart: new Date().toISOString(),
          },
        })
      }

      await payload.update({
        collection: 'tenants',
        id: currentUser.tenantId,
        data: { status: 'active' },
      })

      return NextResponse.json({ url: successUrl })
    }

    // Paid plan - need Stripe checkout
    let stripePriceId = planData.stripePriceId
    let stripeProductId = planData.stripeProductId

    // Auto-create Stripe product/price if missing (e.g. plan created before hook)
    if (!stripePriceId) {
      const stripeService = new StripeService(stripeSecretKey)
      const interval = planData.billingCycle === 'yearly' ? 'year' as const : planData.billingCycle === 'monthly' ? 'month' as const : undefined
      const { product, price } = await stripeService.createProduct(
        planData.name,
        planData.description || '',
        planData.price,
        interval,
      )
      stripePriceId = price.id
      stripeProductId = product.id

      // Save IDs to the plan
      await payload.update({
        collection: 'pricing-plans' as any,
        id: planId,
        data: { stripePriceId, stripeProductId },
      })
    }

    const stripeService = new StripeService(stripeSecretKey)

    // Find or create Stripe customer
    const existingSubs = await payload.find({
      collection: 'subscriptions',
      where: { tenant: { equals: currentUser.tenantId } },
      limit: 1,
    })

    let stripeCustomerId = existingSubs.docs[0] ? (existingSubs.docs[0] as any).stripeCustomerId : null

    if (!stripeCustomerId) {
      const tenant = await payload.findByID({ collection: 'tenants', id: currentUser.tenantId })
      const customer = await stripeService.createCustomer(
        currentUser.email,
        (tenant as any)?.name || `Tenant ${currentUser.tenantId}`,
        { tenantId: String(currentUser.tenantId) },
      )
      stripeCustomerId = customer.id
    }

    const session = await stripeService.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: stripePriceId,
      successUrl,
      cancelUrl,
      metadata: {
        tenantId: String(currentUser.tenantId),
        planId: String(planId),
        type: 'subscription',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Subscribe checkout error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
