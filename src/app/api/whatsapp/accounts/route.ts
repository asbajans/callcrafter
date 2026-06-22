import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { getUserIdFromToken } from '@/lib/auth'

async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null
  const userId = await getUserIdFromToken(token)
  if (!userId) return null
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
  if (!user) return null
  const tenantId = user.tenant ? (typeof user.tenant === 'object' ? (user.tenant as any).id : user.tenant) : undefined
  return { id: user.id as number, email: user.email as string, role: user.role as string, tenantId }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayload({ config })
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where: any = {}
  if (user.role === 'tenant-admin' && user.tenantId) {
    where.tenant = { equals: user.tenantId }
  }

  const result = await payload.find({
    collection: 'whatsapp-accounts' as any,
    where,
    page,
    limit,
    depth: 1,
    sort: '-createdAt',
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayload({ config })
  const data = await req.json()

  const result = await payload.create({
    collection: 'whatsapp-accounts' as any,
    data: {
      ...data,
      tenant: data.tenant || user.tenantId,
    },
    depth: 1,
  })

  return NextResponse.json(result, { status: 201 })
}
