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

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !['admin', 'super-admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const tenantId = searchParams.get('tenantId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const channel = searchParams.get('channel')
  const service = searchParams.get('service')
  const format = searchParams.get('format')

  const payload = await getPayload({ config })

  const where: any = {}
  if (tenantId) where.tenant = { equals: tenantId }
  if (channel) where.channel = { equals: channel }
  if (service) where.service = { equals: service }
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
    depth: 1,
  })

  // Aggregate totals
  let totalCredits = 0
  const byService: Record<string, number> = {}
  const byChannel: Record<string, number> = {}
  const byTenant: Record<string, number> = {}

  for (const doc of logs.docs) {
    const creds = (doc as any).creditsUsed || 0
    totalCredits += creds
    const svc = (doc as any).service || 'unknown'
    byService[svc] = (byService[svc] || 0) + creds
    const ch = (doc as any).channel || 'unknown'
    byChannel[ch] = (byChannel[ch] || 0) + creds
    const tId = typeof (doc as any).tenant === 'object' ? (doc as any).tenant?.id : (doc as any).tenant
    if (tId) byTenant[tId] = (byTenant[tId] || 0) + creds
  }

  // CSV export
  if (format === 'csv') {
    const rows = [['Date', 'Tenant', 'Channel', 'Service', 'Provider', 'Model', 'Credits', 'Duration', 'Tokens', 'Characters']]
    for (const doc of logs.docs) {
      const d = doc as any
      rows.push([
        d.createdAt,
        d.tenant?.name || d.tenant?.id || '',
        d.channel,
        d.service,
        d.provider,
        d.model || '',
        String(d.creditsUsed || 0),
        String(d.duration || 0),
        String(d.tokens || 0),
        String(d.characters || 0),
      ])
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=usage-report.csv' },
    })
  }

  return NextResponse.json({ ...logs, totals: { totalCredits, byService, byChannel, byTenant } })
}
