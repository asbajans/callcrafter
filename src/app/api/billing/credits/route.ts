import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

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

export async function GET() {
  try {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const credits = await payload.find({
      collection: 'tenant-credits' as any,
      where: { tenant: { equals: tenantId } },
      limit: 1,
    })

    if (credits.docs.length === 0) {
      return NextResponse.json({
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        totalExpired: 0,
        monthlyLimit: null,
        earliestExpiry: null,
      })
    }

    return NextResponse.json(credits.docs[0])
  } catch (error) {
    console.error('Get credits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
