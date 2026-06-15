import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { WhatsAppQRBridgeAdapter } from '@/channels/whatsapp/WhatsAppQRBridgeAdapter'
import {
  resolveAccount, createQrAdapter, findOrCreateConversation,
  logWhatsAppMessage, processWithAI, updateConversationLastMessage,
} from '../shared'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const payload = await getPayload({ config })

    const accountId = body.instance
    let account: any = null

    if (accountId) {
      account = await resolveAccount(accountId)
    } else {
      const accounts = await payload.find({
        collection: 'whatsapp-accounts' as any,
        where: {
          and: [
            { connectionType: { equals: 'qr' } },
            { isActive: { equals: true } },
          ],
        },
        depth: 1,
        limit: 1,
      })
      account = accounts.docs[0] ?? null
    }

    if (!account) {
      return NextResponse.json({ status: 'no account' })
    }

    const adapter = createQrAdapter(account)
    if (!adapter) {
      return NextResponse.json({ status: 'no adapter' })
    }

    if (!adapter.verifyWebhook(body)) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
    }

    const webhookData = adapter.handleWebhook(body)

    await payload.create({
      collection: 'webhook-logs',
      data: {
        eventType: 'whatsapp_qr_inbound',
        source: 'whatsapp',
        status: 'success',
        payload: body,
      },
    })

    if (webhookData.connectionUpdate) {
      await payload.update({
        collection: 'whatsapp-accounts' as any,
        id: account.id,
        data: {
          qrStatus: webhookData.connectionUpdate.state === 'open' ? 'connected'
            : webhookData.connectionUpdate.state === 'connecting' ? 'connecting'
            : 'disconnected',
        } as any,
      })
      return NextResponse.json({ status: 'connection_update' })
    }

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
            deliveredAt: statusUpdate.status === 'delivered' ? new Date().toISOString() : undefined,
            readAt: statusUpdate.status === 'read' ? new Date().toISOString() : undefined,
          } as any,
        })
      }
    }

    for (const msg of webhookData.messages) {
      if (msg.from === 'me') continue

      const contactPhone = msg.remoteJid?.replace(/@s\.whatsapp\.net$/, '') || msg.from

      const conversation = await findOrCreateConversation(account, account.tenant, contactPhone, msg.pushName)

      const messageBody = msg.text ?? ''
      if (!messageBody) continue

      await logWhatsAppMessage(conversation.id, 'inbound', {
        whatsAppMessageId: msg.id,
        messageType: msg.type,
        body: messageBody,
        mediaUrl: msg.mediaUrl,
        mediaCaption: msg.mediaCaption,
      })
      await updateConversationLastMessage(conversation.id, messageBody)

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

      await adapter.sendText(account.qrSessionId || account.id.toString(), contactPhone, responseText)

      await logWhatsAppMessage(conversation.id, 'outbound', {
        messageType: 'text',
        body: responseText,
      })
      await updateConversationLastMessage(conversation.id, responseText)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('WhatsApp QR webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
