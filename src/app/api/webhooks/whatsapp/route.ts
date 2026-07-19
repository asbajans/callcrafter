import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { WhatsAppAdapter } from '@/channels/whatsapp/WhatsAppAdapter'
import {
  createAdapter, findOrCreateConversation,
  logWhatsAppMessage, processWithAI, updateConversationLastMessage,
} from './shared'

async function findAccountByVerifyToken(token: string) {
  const payload = await getPayload({ config })
  const accounts = await payload.find({
    collection: 'whatsapp-accounts' as any,
    where: {
      and: [
        { connectionType: { equals: 'cloud_api' } },
        { isActive: { equals: true } },
        { webhookVerifyToken: { equals: token } },
      ],
    },
    limit: 1,
  })
  if (accounts.docs.length > 0) return accounts.docs[0]

  const all = await payload.find({
    collection: 'whatsapp-accounts' as any,
    where: {
      and: [
        { connectionType: { equals: 'cloud_api' } },
        { isActive: { equals: true } },
      ],
    },
  })
  for (const acc of all.docs) {
    const adapter = createAdapter(acc)
    if (adapter?.verifyWebhook('subscribe', token, 'test')) {
      return acc
    }
  }
  return null
}

async function findAccountByPhoneNumberId(phoneNumberId: string) {
  const payload = await getPayload({ config })
  const accounts = await payload.find({
    collection: 'whatsapp-accounts' as any,
    where: {
      and: [
        { connectionType: { equals: 'cloud_api' } },
        { isActive: { equals: true } },
        { phoneNumberId: { equals: phoneNumberId } },
      ],
    },
    limit: 1,
  })
  return accounts.docs[0] || null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode') || ''
  const token = searchParams.get('hub.verify_token') || ''
  const challenge = searchParams.get('hub.challenge') || ''

  const account = await findAccountByVerifyToken(token)
  if (!account) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
  }

  const adapter = createAdapter(account)
  if (!adapter) {
    return NextResponse.json({ error: 'Adapter not available' }, { status: 500 })
  }

  const result = adapter.verifyWebhook(mode, token, challenge)
  if (result) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const payload = await getPayload({ config })

    // Extract phoneNumberId from webhook payload to find the correct account
    const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || ''
    let account = phoneNumberId ? await findAccountByPhoneNumberId(phoneNumberId) : null

    if (!account) {
      // Fallback: try each active Cloud API account
      const accounts = await payload.find({
        collection: 'whatsapp-accounts' as any,
        where: {
          and: [
            { connectionType: { equals: 'cloud_api' } },
            { isActive: { equals: true } },
          ],
        },
        depth: 1,
      })
      account = accounts.docs[0] || null
    }

    if (!account) {
      return NextResponse.json({ status: 'no account' })
    }

    const adapter = createAdapter(account)
    if (!adapter) {
      return NextResponse.json({ status: 'no adapter' })
    }

    const webhookData = adapter.handleWebhook(body)

    await payload.create({
      collection: 'webhook-logs',
      data: {
        eventType: 'whatsapp_inbound',
        source: 'whatsapp',
        status: 'success',
        payload: body,
      },
    })

    for (const statusUpdate of webhookData.statuses) {
      const messages = await payload.find({
        collection: 'whatsapp-messages' as any,
        where: { whatsAppMessageId: { equals: statusUpdate.messageId } },
        limit: 1,
      })
      if (messages.docs.length > 0) {
        await payload.update({
          collection: 'whatsapp-messages' as any,
          id: messages.docs[0].id,
          data: {
            status: statusUpdate.status,
            deliveredAt: statusUpdate.status === 'delivered' ? statusUpdate.timestamp.toISOString() : undefined,
            readAt: statusUpdate.status === 'read' ? statusUpdate.timestamp.toISOString() : undefined,
          } as any,
        })
      }
    }

    for (const msg of webhookData.messages) {
      if (msg.type === 'text' && !msg.text) continue

      const conversation = await findOrCreateConversation(account, account.tenant, msg.from, msg.name)

      const messageBody = msg.text ?? msg.mediaCaption ?? ''
      const messageType = msg.type === 'location' ? 'location' : msg.mediaUrl ? msg.type : 'text'

      const logData: any = {
        whatsAppMessageId: msg.id,
        messageType,
        body: messageBody,
        mediaUrl: msg.mediaUrl,
        mediaMimeType: msg.mediaMimeType,
        mediaCaption: msg.mediaCaption,
      }

      if (msg.type === 'location') {
        logData.body = `${msg.latitude},${msg.longitude}`
      }

      await logWhatsAppMessage(conversation.id, 'inbound', logData)
      await updateConversationLastMessage(conversation.id, messageBody)

      if (!messageBody) continue

      const agent = conversation.agent
      if (!agent) continue

      const recentMessages = await payload.find({
        collection: 'whatsapp-messages' as any,
        where: { conversation: { equals: conversation.id } },
        sort: '-createdAt',
        limit: 10,
        depth: 0,
      })

      const history = recentMessages.docs.reverse().map((m: any) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.body || '',
      }))

      const agentData = typeof agent === 'object' ? agent : await payload.findByID({ collection: 'agents', id: agent, depth: 2 })
      if (!agentData) continue

      const responseText = await processWithAI(agentData, messageBody, history)

      await adapter.sendText(msg.from, responseText)
      await adapter.markAsRead(msg.id)

      await logWhatsAppMessage(conversation.id, 'outbound', {
        messageType: 'text',
        body: responseText,
      })
      await updateConversationLastMessage(conversation.id, responseText)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
