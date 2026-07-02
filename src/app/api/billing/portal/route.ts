import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { StripeService } from '@/billing/StripeService'

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const { cookies } = await import('next/headers')
    const { getUserIdFromToken } = await import('@/lib/auth')
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userId = await getUserIdFromToken(token)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const user = await payload.findByID({ collection: 'users', id: userId, depth: 2 })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = user as any
    const tenantId = typeof userData.tenant === 'object' ? userData.tenant?.id : userData.tenant
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const subs = await payload.find({
      collection: 'subscriptions',
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })

    const stripeCustomerId = subs.docs[0] ? (subs.docs[0] as any).stripeCustomerId : null
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 })
    }

    const { returnUrl } = await req.json()
    const stripeService = new StripeService(stripeSecretKey)
    const session = await stripeService.createPortalSession(stripeCustomerId, returnUrl || req.headers.get('origin') || '')

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Portal session error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
