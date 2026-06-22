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
  return { id: user.id as number, email: user.email as string, role: user.role as string, tenantId: user.tenant ? (typeof user.tenant === 'object' ? (user.tenant as any).id : user.tenant) : undefined }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  const result = await payload.find({
    collection: 'whatsapp-messages' as any,
    where: { conversation: { equals: id } },
    page,
    limit,
    depth: 1,
    sort: '-createdAt',
  })

  return NextResponse.json(result)
}
