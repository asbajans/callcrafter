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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })

  const account = await payload.findByID({ collection: 'whatsapp-accounts' as any, id })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await payload.update({
    collection: 'whatsapp-accounts' as any,
    id,
    data: { isActive: !account.isActive },
  })

  return NextResponse.json(result)
}
