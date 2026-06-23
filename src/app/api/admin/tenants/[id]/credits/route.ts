import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CreditService } from '@/billing/CreditService'

async function getCurrentUser() {
  const { cookies } = await import('next/headers')
  const { getUserIdFromToken } = await import('@/lib/auth')
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null
  const userId = await getUserIdFromToken(token)
  if (!userId) return null
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
  if (!user) return null
  return { id: user.id as number, email: user.email as string, role: user.role as string }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !['admin', 'super-admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { amount, description, expiresAt } = body

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const service = new CreditService()
  const success = await service.addCredits(id, amount, 'admin', {
    description: description || `Manual add by ${user.email}`,
    expiresAt: expiresAt || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  })

  if (!success) {
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
  }

  const newBalance = await service.getBalance(id)
  return NextResponse.json({ success: true, balance: newBalance })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !['admin', 'super-admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  const payload = await getPayload({ config })
  const transactions = await payload.find({
    collection: 'credit-transactions' as any,
    where: { tenant: { equals: id } },
    sort: '-createdAt',
    page,
    limit,
  })

  return NextResponse.json(transactions)
}
