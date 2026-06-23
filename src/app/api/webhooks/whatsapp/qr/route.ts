import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  createQrAdapter, findOrCreateConversation,
  logWhatsAppMessage, processWithAI, updateConversationLastMessage,
} from '../shared'
import { checkCreditBalance, deductAICost } from '@/billing/creditMiddleware'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[QR-Webhook] Received webhook:', JSON.stringify(body).slice(0, 1000))
    const payload = await getPayload({ config })

    const accountId = body.instance
    console.log('[QR-Webhook] instance field:', accountId)
    let account: any = null

    if (accountId) {
      const accounts = await payload.find({
        collection: 'whatsapp-accounts' as any,
        where: { qrSessionId: { equals: accountId } },
        depth: 1,
        limit: 1,
      })
      account = accounts.docs[0] ?? null
      if (!account) {
        console.log('[QR-Webhook] Account not found by qrSessionId:', accountId)
      }
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
      console.log('[QR-Webhook] No account found, returning no account')
      return NextResponse.json({ status: 'no account' })
    }

    const adapter = createQrAdapter(account)
    if (!adapter) {
      console.log('[QR-Webhook] No adapter created for account:', account.id)
      return NextResponse.json({ status: 'no adapter' })
    }

    const webhookData = adapter.handleWebhook(body)
    console.log('[QR-Webhook] handleWebhook result:', JSON.stringify({
      hasConnectionUpdate: !!webhookData.connectionUpdate,
      statusCount: webhookData.statuses.length,
      messageCount: webhookData.messages.length,
      connectionState: webhookData.connectionUpdate?.state,
    }))

    await payload.create({
      collection: 'webhook-logs',
      data: {
        eventType: 'whatsapp_qr_inbound',
        source: 'whatsapp',
        status: 'success',
        payload: body,
      },
    }).catch((e: any) => console.log('[QR-Webhook] Failed to save log:', e.message))

    if (webhookData.connectionUpdate) {
      const newStatus = webhookData.connectionUpdate.state === 'open' ? 'connected'
        : webhookData.connectionUpdate.state === 'connecting' ? 'connecting'
        : 'disconnected'
      console.log('[QR-Webhook] Connection update for account', account.id, ':', webhookData.connectionUpdate.state, '->', newStatus)
      await payload.update({
        collection: 'whatsapp-accounts' as any,
        id: account.id,
        data: { qrStatus: newStatus } as any,
      })
      return NextResponse.json({ status: 'connection_update' })
    }

    for (const statusUpdate of webhookData.statuses) {
      console.log('[QR-Webhook] Status update:', statusUpdate)
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
      console.log('[QR-Webhook] Processing message:', { from: msg.from, text: msg.text, type: msg.type, id: msg.id })

      // Handle AI-sent outbound messages (fromMe) — update record with message ID
      if (msg.from === 'me') {
        console.log('[QR-Webhook] Outbound message webhook, to:', msg.to, 'id:', msg.id)
        const convs = await payload.find({
          collection: 'whatsapp-conversations' as any,
          where: {
            and: [
              { account: { equals: account.id } },
              { contactPhone: { equals: msg.to } },
            ],
          },
          sort: '-lastMessageAt',
          limit: 1,
        })
        if (convs.docs.length > 0) {
          const convId = convs.docs[0].id
          const latest = await payload.find({
            collection: 'whatsapp-messages' as any,
            where: {
              and: [
                { direction: { equals: 'outbound' } },
                { conversation: { equals: convId } },
              ],
            },
            sort: '-createdAt',
            limit: 1,
          })
          const record = latest.docs[0]
          if (record && !record.whatsAppMessageId) {
            await payload.update({
              collection: 'whatsapp-messages' as any,
              id: record.id,
              data: { whatsAppMessageId: msg.id } as any,
            })
            console.log('[QR-Webhook] Updated outbound msg', record.id, 'with waId:', msg.id)
          }
        }
        continue
      }

      const contactPhone = msg.from

      const conversation = await findOrCreateConversation(account, account.tenant, contactPhone, msg.pushName, msg.remoteJid)

      const messageBody = msg.text ?? ''
      if (!messageBody) {
        console.log('[QR-Webhook] Skipping message with no body:', msg.id)
        continue
      }

      console.log('[QR-Webhook] Creating inbound message for conversation:', conversation.id)
      await logWhatsAppMessage(conversation.id, 'inbound', {
        whatsAppMessageId: msg.id,
        messageType: msg.type,
        body: messageBody,
        mediaUrl: msg.mediaUrl,
        mediaCaption: msg.mediaCaption,
      })
      await updateConversationLastMessage(conversation.id, messageBody)

      const agent = conversation.agent
      if (!agent) {
        console.log('[QR-Webhook] No agent assigned to conversation:', conversation.id)
        continue
      }

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
      if (!agentData) {
        console.log('[QR-Webhook] Agent data not found')
        continue
      }

      console.log('[QR-Webhook] Processing with AI for agent:', agentData.id)

      // Credit check
      const tenantIdForCredit = typeof account.tenant === 'object' ? account.tenant.id : account.tenant
      const creditCheck = await checkCreditBalance(tenantIdForCredit, 2)
      if (!creditCheck.ok) {
        console.log('[QR-Webhook] Insufficient credits, sending warning:', creditCheck.error)
        try {
          await adapter.sendText(account.qrSessionId || account.id.toString(), contactPhone,
            `⚠️ Kredi bakiyeniz yetersiz (${creditCheck.balance} kredi). Lütfen yöneticinizle iletişime geçin.`)
        } catch {}
        continue
      }

      const responseText = await processWithAI(agentData, messageBody, history)

      // Deduct credits
      const inputTokens = Math.ceil(messageBody.length / 4)
      const outputTokens = Math.ceil(responseText.length / 4)
      await deductAICost(tenantIdForCredit, {
        conversation: String(conversation.id),
        channel: 'whatsapp',
        service: 'llm',
        provider: typeof agentData.model === 'string' ? agentData.model : 'openai',
        model: agentData.model,
        inputTokens,
        outputTokens,
      })

      // Send reply and log outbound — if send fails, still log with 'failed' status
      let sendFailed = false
      try {
        console.log('[QR-Webhook] Sending reply:', responseText.slice(0, 100))
        await adapter.sendText(account.qrSessionId || account.id.toString(), contactPhone, responseText)
      } catch (e) {
        console.error('[QR-Webhook] sendText failed, still logging outbound:', e)
        sendFailed = true
      }

      await logWhatsAppMessage(conversation.id, 'outbound', {
        messageType: 'text',
        body: responseText,
        status: sendFailed ? 'failed' : 'sent',
      })
      await updateConversationLastMessage(conversation.id, responseText)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('WhatsApp QR webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
