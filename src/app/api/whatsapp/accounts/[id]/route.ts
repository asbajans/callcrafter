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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })

  const account = await payload.findByID({ collection: 'whatsapp-accounts' as any, id, depth: 2 })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(account)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })
  const data = await req.json()

  const result = await payload.update({
    collection: 'whatsapp-accounts' as any,
    id,
    data,
    depth: 1,
  })

  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })

  // First disconnect QR session if any
  try {
    const account = await payload.findByID({ collection: 'whatsapp-accounts' as any, id, depth: 0 })
    if (account?.qrSessionId) {
      const { WhatsAppQRBridgeAdapter } = await import('@/channels/whatsapp/WhatsAppQRBridgeAdapter')
      const adapter = new WhatsAppQRBridgeAdapter({
        baseUrl: process.env.WA_BRIDGE_URL || 'http://wa-bridge:8080',
        apiKey: process.env.WA_BRIDGE_API_KEY || '',
      })
      await adapter.deleteSession(account.qrSessionId).catch(() => {})
    }
  } catch (e) {
    console.log('[Accounts] Failed to cleanup QR session:', e)
  }

  await payload.delete({ collection: 'whatsapp-accounts' as any, id })
  console.log('[Accounts] Deleted account', id, 'by user', user.id)
  return NextResponse.json({ success: true })
}
