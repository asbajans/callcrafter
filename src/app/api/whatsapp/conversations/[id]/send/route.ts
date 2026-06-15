import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { WhatsAppAdapter } from '@/channels/whatsapp/WhatsAppAdapter'
import { WhatsAppQRBridgeAdapter } from '@/channels/whatsapp/WhatsAppQRBridgeAdapter'

async function getUser(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })
  const data = await req.json()

  const conversation = await payload.findByID({
    collection: 'whatsapp-conversations' as any,
    id,
    depth: 2,
  })
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const account = conversation.account as any
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  let sendResult: any

  if (account.connectionType === 'cloud_api') {
    const adapter = new WhatsAppAdapter({
      accessToken: account.accessToken || '',
      phoneNumberId: account.phoneNumberId || '',
      webhookVerifyToken: account.webhookVerifyToken || '',
    })

    if (data.body) {
      sendResult = await adapter.sendText(conversation.contactPhone, data.body)
    } else if (data.templateName) {
      sendResult = await adapter.sendTemplate(conversation.contactPhone, data.templateName, data.languageCode, data.templateParams)
    } else if (data.mediaUrl) {
      sendResult = await adapter.sendMedia(conversation.contactPhone, data.mediaType || 'image', data.mediaUrl, data.caption)
    }
  } else if (account.connectionType === 'qr') {
    const adapter = new WhatsAppQRBridgeAdapter({
      baseUrl: process.env.WA_BRIDGE_URL || 'http://wa-bridge:8080',
      apiKey: process.env.WA_BRIDGE_API_KEY || '',
    })

    const sessionId = account.qrSessionId || account.id.toString()
    if (data.body) {
      sendResult = await adapter.sendText(sessionId, conversation.contactPhone, data.body)
    } else if (data.mediaUrl) {
      sendResult = await adapter.sendMedia(sessionId, conversation.contactPhone, data.mediaType || 'image', data.mediaUrl, data.caption)
    }
  }

  await payload.update({
    collection: 'whatsapp-conversations' as any,
    id,
    data: {
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: (data.body || data.templateName || '').slice(0, 100),
    },
  })

  const message = await payload.create({
    collection: 'whatsapp-messages' as any,
    data: {
      conversation: id,
      whatsAppMessageId: sendResult?.messages?.[0]?.id,
      direction: 'outbound',
      messageType: data.body ? 'text' : data.templateName ? 'template' : data.mediaType || 'text',
      body: data.body || data.caption || null,
      templateName: data.templateName || null,
      sentBy: user.userId as any,
      status: 'sent',
    },
  })

  return NextResponse.json(message, { status: 201 })
}
