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

  switch (action) {
    case 'start': {
      // Use unique session name each time to avoid stale Baileys auth data
      const sessionId = `wa_${id}_${Date.now()}`
      const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://callcrafter.com.tr'}/api/webhooks/whatsapp/qr`
      console.log('[QR] Starting session', { sessionId, webhookUrl, waBridgeUrl: process.env.WA_BRIDGE_URL, hasApiKey: !!process.env.WA_BRIDGE_API_KEY })
      try {
        const session = await adapter.startSession(sessionId, webhookUrl)
        console.log('[QR] Session result', { sessionId: session.sessionId, hasQrCode: !!session.qrCode, hasQrImageUrl: !!session.qrImageUrl, status: session.status })
        await payload.update({
          collection: 'whatsapp-accounts' as any,
          id,
          data: {
            qrSessionId: session.sessionId,
            qrCodeData: session.qrCode,
            qrStatus: session.status,
          },
        })

        // Start background polling for QR code (fire-and-forget)
        adapter.pollForQrInBackground(sessionId, async (update) => {
          try {
            const p = await getPayload({ config })
            await p.update({
              collection: 'whatsapp-accounts' as any,
              id,
              data: {
                ...(update.qrCode ? { qrCodeData: update.qrCode } : {}),
                ...(update.qrBase64 ? { qrCodeData: update.qrBase64 } : {}),
                qrStatus: update.status,
              },
            })
            console.log(`[QR] Background update for account ${id}:`, update)
          } catch (e) {
            console.error(`[QR] Background update failed for ${id}:`, e)
          }
        }).catch((err) => console.error('[QR] Background polling error:', err))

        return NextResponse.json(session)
      } catch (err: any) {
        console.error('[QR] startSession failed:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
      }
    }

    case 'connect': {
      const connectSessionId = account.qrSessionId
      if (!connectSessionId) return NextResponse.json({ error: 'No active session' }, { status: 400 })
      const session = await adapter.getSessionStatus(connectSessionId)
      if (session.qrCode) {
        await payload.update({
          collection: 'whatsapp-accounts' as any,
          id,
          data: { qrCodeData: session.qrCode, qrStatus: session.status } as any,
        })
      } else if (session.status === 'connected') {
        await payload.update({
          collection: 'whatsapp-accounts' as any,
          id,
          data: { qrStatus: 'connected' },
        })
      }
      return NextResponse.json(session)
    }

    case 'disconnect': {
      const disconnectSessionId = account.qrSessionId
      if (disconnectSessionId) {
        await adapter.disconnectSession(disconnectSessionId)
      }
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
