import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { getUserIdFromToken } from '@/lib/auth'
import { WhatsAppQRBridgeAdapter } from '@/channels/whatsapp/WhatsAppQRBridgeAdapter'

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

function getQrAdapter() {
  return new WhatsAppQRBridgeAdapter({
    baseUrl: process.env.WA_BRIDGE_URL || 'http://wa-bridge:8080',
    apiKey: process.env.WA_BRIDGE_API_KEY || '',
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })
  const body = await req.json()
  const action = body.action || 'start'

  const account = await payload.findByID({ collection: 'whatsapp-accounts' as any, id })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const adapter = getQrAdapter()
  const sessionId = account.qrSessionId || `wa_${id}`

  switch (action) {
    case 'start': {
      const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://callcrafter.com.tr'}/api/webhooks/whatsapp/qr`
      const session = await adapter.startSession(sessionId, webhookUrl)
      await payload.update({
        collection: 'whatsapp-accounts' as any,
        id,
        data: {
          qrSessionId: session.sessionId,
          qrCodeData: session.qrCode,
          qrStatus: session.status,
        },
      })
      return NextResponse.json(session)
    }

    case 'connect': {
      const session = await adapter.getSessionStatus(sessionId)
      if (session.status === 'connected') {
        await adapter.setWebhook(sessionId, `${process.env.NEXT_PUBLIC_BASE_URL || 'https://callcrafter.com.tr'}/api/webhooks/whatsapp/qr`)
        await payload.update({
          collection: 'whatsapp-accounts' as any,
          id,
          data: { qrStatus: 'connected' },
        })
      }
      return NextResponse.json(session)
    }

    case 'disconnect': {
      await adapter.disconnectSession(sessionId)
      await payload.update({
        collection: 'whatsapp-accounts' as any,
        id,
        data: { qrStatus: 'disconnected', qrCodeData: null },
      })
      return NextResponse.json({ status: 'disconnected' })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
