import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !['admin', 'super-admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const payload = await getPayload({ config })
  const where: any = { tenant: { equals: id } }
  if (startDate || endDate) {
    const dateFilter: any = {}
    if (startDate) dateFilter.greater_than = startDate
    if (endDate) dateFilter.less_than = endDate
    where.createdAt = dateFilter
  }

  const logs = await payload.find({
    collection: 'usage-logs' as any,
    where,
    sort: '-createdAt',
    page,
    limit,
  })

  // Aggregate totals
  let totalCredits = 0
  const byService: Record<string, number> = {}
  const byChannel: Record<string, number> = {}
  for (const doc of logs.docs) {
    const creds = (doc as any).creditsUsed || 0
    totalCredits += creds
    const svc = (doc as any).service || 'unknown'
    byService[svc] = (byService[svc] || 0) + creds
    const ch = (doc as any).channel || 'unknown'
    byChannel[ch] = (byChannel[ch] || 0) + creds
  }

  return NextResponse.json({ ...logs, totals: { totalCredits, byService, byChannel } })
}
