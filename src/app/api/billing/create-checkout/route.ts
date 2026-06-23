import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { StripeService } from '@/billing/StripeService'

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

    // Try to get tenant from user's tenant field or from their subscription
    const userData = user as any
    if (userData.tenant) {
      return typeof userData.tenant === 'object' ? userData.tenant.id : userData.tenant
    }

    // Fallback: find the user's subscription
    const subs = await payload.find({
      collection: 'subscriptions',
      where: { user: { equals: userId } },
      limit: 1,
    })
    if (subs.docs.length > 0) {
      const sub = subs.docs[0] as any
      return typeof sub.tenant === 'object' ? sub.tenant.id : sub.tenant
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

    const { packageId, successUrl, cancelUrl } = await req.json()
    if (!packageId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tenantId = await getCurrentTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const pkg = await payload.findByID({
      collection: 'credit-packages' as any,
      id: packageId,
    })

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    const pkgData = pkg as any
    const credits = pkgData.credits
    const priceInCents = Math.round((pkgData.price || 0) * 100)

    if (!credits || !priceInCents) {
      return NextResponse.json({ error: 'Invalid package configuration' }, { status: 400 })
    }

    const stripeService = new StripeService(stripeSecretKey)

    const session = await stripeService.createCreditCheckoutSession({
      tenantId,
      creditPackageId: packageId,
      credits,
      priceInCents,
      successUrl,
      cancelUrl,
      metadata: {
        tenantId: String(tenantId),
        creditPackageId: String(packageId),
        credits: String(credits),
        type: 'credit_purchase',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Create checkout error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
