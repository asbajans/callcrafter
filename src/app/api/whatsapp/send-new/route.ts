import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { getUserIdFromToken } from '@/lib/auth'
import { WhatsAppAdapter } from '@/channels/whatsapp/WhatsAppAdapter'
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

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayload({ config })
  const data = await req.json()

  const account = await payload.findByID({
    collection: 'whatsapp-accounts' as any,
    id: data.accountId,
    depth: 1,
  })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const existingConv = await payload.find({
    collection: 'whatsapp-conversations' as any,
    where: {
      and: [
        { account: { equals: account.id } },
        { contactPhone: { equals: data.to } },
      ],
    },
    limit: 1,
  })

  let conversation: any
  if (existingConv.docs.length > 0) {
    conversation = existingConv.docs[0]
  } else {
    conversation = await payload.create({
      collection: 'whatsapp-conversations' as any,
      data: {
        account: account.id,
        tenant: account.tenant,
        contactPhone: data.to,
        contactName: data.contactName || null,
        status: 'open',
        lastMessageAt: new Date().toISOString(),
      },
    })
  }

  let sendResult: any

  if (account.connectionType === 'cloud_api') {
    const adapter = new WhatsAppAdapter({
      accessToken: account.accessToken || '',
      phoneNumberId: account.phoneNumberId || '',
      webhookVerifyToken: account.webhookVerifyToken || '',
    })

    if (data.body) {
      sendResult = await adapter.sendText(data.to, data.body)
    } else if (data.templateName) {
      sendResult = await adapter.sendTemplate(data.to, data.templateName, data.languageCode, data.templateParams)
    }
  } else if (account.connectionType === 'qr') {
    const adapter = new WhatsAppQRBridgeAdapter({
      baseUrl: process.env.WA_BRIDGE_URL || 'http://wa-bridge:8080',
      apiKey: process.env.WA_BRIDGE_API_KEY || '',
    })

    const sessionId = account.qrSessionId || account.id.toString()
    if (data.body) {
      sendResult = await adapter.sendText(sessionId, data.to, data.body)
    }
  }

  const message = await payload.create({
    collection: 'whatsapp-messages' as any,
    data: {
      conversation: conversation.id,
      direction: 'outbound',
      messageType: data.body ? 'text' : 'template',
      body: data.body || null,
      templateName: data.templateName || null,
      sentBy: user.id,
      status: 'sent',
    },
  })

  await payload.update({
    collection: 'whatsapp-conversations' as any,
    id: conversation.id,
    data: {
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: (data.body || data.templateName || '').slice(0, 100),
    },
  })

  return NextResponse.json({ conversation, message }, { status: 201 })
}
