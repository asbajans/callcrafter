import { getPayload } from 'payload'
import config from '@payload-config'
import { WhatsAppAdapter, type WhatsAppConfig } from '@/channels/whatsapp/WhatsAppAdapter'
import { WhatsAppQRBridgeAdapter, type WhatsAppQRBridgeConfig } from '@/channels/whatsapp/WhatsAppQRBridgeAdapter'
import { AgentOrchestrator, type AgentContext } from '@/ai/orchestrator/AgentOrchestrator'
import postgres from 'postgres'

const modelMap: Record<string, { provider: 'openai' | 'anthropic'; model: string }> = {
  'gpt-4': { provider: 'openai', model: 'gpt-4' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
  'claude-3-opus': { provider: 'anthropic', model: 'claude-3-opus-latest' },
  'claude-3-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
  'claude-3-haiku': { provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
}

const CONTEXT_RESET_MINUTES = parseInt(process.env.WHATSAPP_CONTEXT_RESET_MINUTES || '30', 10)

export async function resolveAccount(accountId?: number | string) {
  const payload = await getPayload({ config })
  if (accountId) {
    const account = await payload.findByID({ collection: 'whatsapp-accounts' as any, id: accountId, depth: 1 })
    return account
  }
  const accounts = await payload.find({
    collection: 'whatsapp-accounts' as any,
    where: { isActive: { equals: true } },
    depth: 1,
    limit: 1,
  })
  return accounts.docs[0] ?? null
}

export function createAdapter(account: any): WhatsAppAdapter | null {
  if (!account || account.connectionType !== 'cloud_api') return null
  return new WhatsAppAdapter({
    accessToken: account.accessToken || '',
    phoneNumberId: account.phoneNumberId || '',
    webhookVerifyToken: account.webhookVerifyToken || '',
    businessAccountId: account.businessAccountId,
  })
}

export function createQrAdapter(account: any): WhatsAppQRBridgeAdapter | null {
  if (!account || account.connectionType !== 'qr') return null
  return new WhatsAppQRBridgeAdapter({
    baseUrl: process.env.WA_BRIDGE_URL || 'http://wa-bridge:8080',
    apiKey: process.env.WA_BRIDGE_API_KEY || '',
    webhookSecret: process.env.WA_BRIDGE_WEBHOOK_SECRET,
  })
}

let dbClient: any = null;
function getDbClient() {
  if (!dbClient) {
    dbClient = postgres(process.env.DATABASE_URI || '');
  }
  return dbClient;
}

export async function tryResolveQrPhoneFromEvolutionContact(qrSessionId: string, contactName: string): Promise<string | null> {
  if (!qrSessionId || !contactName) return null;
  const sql = getDbClient();
  try {
    const results = await sql`
      SELECT c."remoteJid"
      FROM evolution."Contact" c
      INNER JOIN evolution."Instance" i ON i."id" = c."instanceId"
      WHERE i."name" = ${qrSessionId}
        AND LOWER(c."pushName") = LOWER(${contactName})
        AND c."remoteJid" LIKE '%@s.whatsapp.net'
      ORDER BY c."createdAt" DESC
      LIMIT 1
    `;
    if (results.length > 0) {
      const rawJid = results[0].remoteJid;
      return rawJid ? rawJid.split('@')[0].replace(/\D/g, '') : null;
    }
  } catch (err) {
    console.warn('Failed to resolve QR target phone from evolution contact table:', err);
  }
  return null;
}

export async function tryResolveJidFromEvolutionContact(qrSessionId: string, targetJid: string): Promise<string | null> {
  if (!qrSessionId || !targetJid) return null;
  const isLid = targetJid.endsWith('@lid');
  const searchPattern = isLid ? '%@s.whatsapp.net' : '%@lid';
  const sql = getDbClient();
  try {
    const results = await sql`
      SELECT c2."remoteJid"
      FROM evolution."Contact" c1
      INNER JOIN evolution."Contact" c2 ON c1."instanceId" = c2."instanceId"
      INNER JOIN evolution."Instance" i ON i."id" = c1."instanceId"
      WHERE i."name" = ${qrSessionId}
        AND c1."remoteJid" = ${targetJid}
        AND c2."remoteJid" LIKE ${searchPattern}
        AND (
          (c1."profilePicUrl" IS NOT NULL AND c1."profilePicUrl" != '' 
           AND c2."profilePicUrl" IS NOT NULL AND c2."profilePicUrl" != ''
           AND split_part(split_part(c1."profilePicUrl", '?', 1), '/', cardinality(string_to_array(split_part(c1."profilePicUrl", '?', 1), '/'))) =
               split_part(split_part(c2."profilePicUrl", '?', 1), '/', cardinality(string_to_array(split_part(c2."profilePicUrl", '?', 1), '/')))
          )
          OR
          (c1."pushName" IS NOT NULL AND c1."pushName" != '' AND LOWER(c1."pushName") = LOWER(c2."pushName"))
        )
      ORDER BY c2."createdAt" DESC
      LIMIT 1
    `;
    if (results.length > 0) {
      return results[0].remoteJid || null;
    }
  } catch (err) {
    console.warn('Failed to resolve cross JID for targetJid:', targetJid, err);
  }
  return null;
}

export async function findOrCreateConversation(
  account: any,
  tenantId: string | number,
  contactPhone: string,
  contactName?: string,
  contactJid?: string
) {
  const payload = await getPayload({ config })

  let targetJid = contactJid || '';
  if (!targetJid && !contactPhone.includes('@')) {
    targetJid = `${contactPhone}@s.whatsapp.net`;
  }

  const phoneCandidates = [contactPhone];

  // Try to cross-resolve JID/LID using Evolution Contact database if QR mode
  if (account.connectionType === 'qr' && account.qrSessionId && targetJid) {
    const resolvedJid = await tryResolveJidFromEvolutionContact(account.qrSessionId, targetJid);
    if (resolvedJid) {
      if (resolvedJid.endsWith('@lid')) {
        targetJid = resolvedJid;
      } else {
        const resolvedPhone = resolvedJid.split('@')[0].replace(/\D/g, '');
        if (resolvedPhone && !phoneCandidates.includes(resolvedPhone)) {
          phoneCandidates.push(resolvedPhone);
        }
      }
    }
  }

  const cleanJid = targetJid.trim().toLowerCase();

  // Search query
  const searchQueries: any[] = phoneCandidates.map(phone => ({
    contactPhone: { equals: phone }
  }));
  if (cleanJid) {
    searchQueries.push({ contactJid: { equals: cleanJid } });
  }

  const existing = await payload.find({
    collection: 'whatsapp-conversations' as any,
    where: {
      and: [
        { account: { equals: account.id } },
        { status: { not_equals: 'closed' } },
        {
          or: searchQueries
        }
      ],
    },
    depth: 1,
    limit: 1,
  });

  if (existing.docs.length > 0) {
    const conv = existing.docs[0];
    const updates: any = {};

    if (contactName && conv.contactName !== contactName) {
      updates.contactName = contactName;
    }
    if (cleanJid && conv.contactJid !== cleanJid) {
      updates.contactJid = cleanJid;
    }

    // If the conversation is LID-only, and we now have a real phone number candidate, update it
    const isLidOnly = conv.contactJid?.endsWith('@lid') && conv.contactPhone === conv.contactJid.split('@')[0].replace(/\D/g, '');
    const realPhone = phoneCandidates.find(p => !p.endsWith('@lid') && p !== conv.contactPhone);
    if (isLidOnly && realPhone) {
      updates.contactPhone = realPhone;
    }

    if (Object.keys(updates).length > 0) {
      return await payload.update({
        collection: 'whatsapp-conversations' as any,
        id: conv.id,
        data: updates
      });
    }

    return conv;
  }

  // Determine actual target phone to create with
  let finalPhone = contactPhone;
  if ((contactPhone.endsWith('@lid') || targetJid.endsWith('@lid')) && account.connectionType === 'qr' && account.qrSessionId) {
    const resolvedPhoneJid = await tryResolveJidFromEvolutionContact(account.qrSessionId, targetJid || contactPhone);
    if (resolvedPhoneJid && resolvedPhoneJid.endsWith('@s.whatsapp.net')) {
      const resolvedPhone = resolvedPhoneJid.split('@')[0].replace(/\D/g, '');
      if (resolvedPhone) {
        finalPhone = resolvedPhone;
      }
    }
  }

  // Create new conversation
  const agents = await payload.find({
    collection: 'agents',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { channels: { contains: 'whatsapp' } },
        { status: { equals: 'active' } },
      ],
    },
    depth: 2,
    limit: 1,
  })

  const conversation = await payload.create({
    collection: 'whatsapp-conversations' as any,
    data: {
      account: account.id,
      tenant: tenantId,
      agent: agents.docs[0]?.id || undefined,
      contactPhone: finalPhone,
      contactName: contactName || null,
      contactJid: cleanJid || null,
      status: 'open',
      unreadCount: 1,
      lastMessageAt: new Date().toISOString(),
    } as any,
  })

  return conversation;
}

export async function logWhatsAppMessage(conversationId: number | string, direction: 'inbound' | 'outbound', messageData: {
  whatsAppMessageId?: string
  messageType: string
  body?: string
  mediaUrl?: string
  mediaMimeType?: string
  mediaCaption?: string
  templateName?: string
  status?: string
  sentBy?: number | string
}) {
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'whatsapp-messages' as any,
    data: {
      conversation: conversationId,
      whatsAppMessageId: messageData.whatsAppMessageId,
      direction,
      messageType: messageData.messageType,
      body: messageData.body,
      mediaUrl: messageData.mediaUrl,
      mediaMimeType: messageData.mediaMimeType,
      mediaCaption: messageData.mediaCaption,
      templateName: messageData.templateName,
      status: (messageData.status as any) || 'sent',
      sentBy: messageData.sentBy as any,
    } as any,
  })
}

export async function shouldResetContext(conversationId: number | string): Promise<boolean> {
  const payload = await getPayload({ config })
  const messages = await payload.find({
    collection: 'whatsapp-messages' as any,
    where: { conversation: { equals: conversationId } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  })

  if (messages.docs.length === 0) return false

  const lastMsg = messages.docs[0]
  const lastTime = new Date(lastMsg.createdAt || lastMsg.updatedAt).getTime()
  const now = Date.now()
  const diffMinutes = (now - lastTime) / 1000 / 60

  return diffMinutes >= CONTEXT_RESET_MINUTES
}

export async function prepareConversationHistory(conversationId: number | string, agent: any, userText: string): Promise<{
  history: Array<{ role: string; content: string }>
  finalInput: string
  reset: boolean
}> {
  const reset = await shouldResetContext(conversationId)
  const greeting = agent.greetingMessage || ''

  const payload = await getPayload({ config })
  const recentMessages = await payload.find({
    collection: 'whatsapp-messages' as any,
    where: { conversation: { equals: conversationId } },
    sort: '-createdAt',
    limit: 10,
    depth: 0,
  })

  const history = recentMessages.docs.reverse().map((m: any) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.body || '',
  }))

  if (reset) {
    if (greeting) {
      return {
        history: [],
        finalInput: `${greeting}\n\nCustomer: ${userText}`,
        reset: true,
      }
    }
    return { history: [], finalInput: userText, reset: true }
  }

  return { history, finalInput: userText, reset: false }
}

export async function processWithAI(agent: any, userText: string, conversationHistory: Array<{ role: string; content: string }>): Promise<string> {
  const payload = await getPayload({ config })
  let trainingContext = ''
  if (agent.trainingDocs && agent.trainingDocs.length > 0) {
    const trainingDocIds = agent.trainingDocs.map((d: any) => typeof d === 'object' ? d.id : d)
    const trainingDocs = await payload.find({
      collection: 'training-docs',
      where: { id: { in: trainingDocIds.join(',') } },
    })
    trainingContext = trainingDocs.docs.map((d: any) => d.content).join('\n\n').slice(0, 10000)
  }

  const modelConfig = modelMap[agent.model as string] || { provider: 'openai', model: 'gpt-4o' }
  const apiKeyForProvider = modelConfig.provider === 'openai' ? process.env.OPENAI_API_KEY! : process.env.ANTHROPIC_API_KEY!

  const orchestrator = new AgentOrchestrator({
    provider: modelConfig.provider,
    apiKey: apiKeyForProvider,
    model: modelConfig.model,
  })

  const result = await orchestrator.process({
    text: userText,
    context: {
      agentId: String(agent.id),
      tenantId: typeof agent.tenant === 'object' ? String(agent.tenant.id) : String(agent.tenant),
      systemPrompt: agent.systemPrompt,
      conversationHistory,
      trainingContext,
      channel: 'whatsapp',
      tools: (agent.tools || []) as any,
    },
    channel: 'whatsapp',
  })

  return result.content
}

export async function updateConversationLastMessage(conversationId: number | string, preview: string) {
  const payload = await getPayload({ config })
  await payload.update({
    collection: 'whatsapp-conversations' as any,
    id: conversationId,
    data: {
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: preview.slice(0, 100),
    } as any,
  })
}

export async function incrementUnread(conversationId: number | string) {
  const payload = await getPayload({ config })
  const conv = await payload.findByID({ collection: 'whatsapp-conversations' as any, id: conversationId })
  await payload.update({
    collection: 'whatsapp-conversations' as any,
    id: conversationId,
    data: { unreadCount: (conv.unreadCount || 0) + 1 } as any,
  })
}

export async function analyzeSupportIntent(userText: string, agent: any): Promise<{ needsTicket: boolean; reason: string }> {
  if (!process.env.WHATSAPP_AUTO_TICKET) {
    return { needsTicket: false, reason: 'auto-ticket disabled' }
  }

  const modelConfig = modelMap[agent.model as string] || { provider: 'openai', model: 'gpt-4o-mini' }
  const apiKey = modelConfig.provider === 'openai' ? process.env.OPENAI_API_KEY! : process.env.ANTHROPIC_API_KEY!

  const orchestrator = new AgentOrchestrator({
    provider: modelConfig.provider,
    apiKey,
    model: modelConfig.model,
  })

  const result = await orchestrator.process({
    text: `Analyze this customer message and determine if it requires creating a support ticket. 
Reply with ONLY a JSON object: {"needsTicket": true/false, "reason": "short reason"}.
Message: "${userText}"`,
    context: {
      agentId: String(agent.id),
      tenantId: typeof agent.tenant === 'object' ? String(agent.tenant.id) : String(agent.tenant),
      systemPrompt: 'You are a support intent analyzer. Respond only with JSON.',
      conversationHistory: [],
      channel: 'whatsapp',
      tools: [],
    },
    channel: 'whatsapp',
  })

  try {
    const parsed = JSON.parse(result.content)
    return { needsTicket: !!parsed.needsTicket, reason: parsed.reason || '' }
  } catch {
    return { needsTicket: false, reason: 'parse failed' }
  }
}
