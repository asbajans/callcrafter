import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

async function getUser(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
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
  const user = await getUser(req)
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
