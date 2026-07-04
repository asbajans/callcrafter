import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { deductAICost } from '@/billing/creditMiddleware'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const payload = await getPayload({ config })

    // Log raw webhook for debugging
    await payload.create({
      collection: 'webhook-logs' as any,
      data: {
        source: 'elevenlabs',
        event: body.event_type || 'unknown',
        rawBody: JSON.stringify(body).slice(0, 10000),
      } as any,
    })

    // Find matching agent by ElevenLabs agent_id
    const agentId = body.agent_id
    if (!agentId) {
      return NextResponse.json({ status: 'ignored', reason: 'no agent_id' })
    }

    const agentsRes = await payload.find({
      collection: 'agents' as any,
      where: { elevenlabsAgentId: { equals: agentId } },
      limit: 1,
      depth: 2,
    })

    const agent = agentsRes.docs[0] as any
    if (!agent) {
      return NextResponse.json({ status: 'ignored', reason: 'agent not found' })
    }

    const tenantId = agent.tenant?.id || agent.tenant
    if (!tenantId) {
      return NextResponse.json({ status: 'ignored', reason: 'no tenant' })
    }

    // Create conversation record
    const conversationId = body.conversation_id || `el_${Date.now()}`
    const durationSeconds = body.duration_seconds || 0
    const transcript = body.transcript
      ? typeof body.transcript === 'string'
        ? body.transcript
        : JSON.stringify(body.transcript)
      : ''

    const conversation = await payload.create({
      collection: 'conversations' as any,
      data: {
        tenant: tenantId,
        agent: agent.id,
        channel: 'voice',
        externalId: conversationId,
        status: body.status === 'completed' ? 'completed' : body.status === 'missed' ? 'missed' : 'active',
        startTime: body.start_time || new Date().toISOString(),
        endTime: body.end_time || new Date().toISOString(),
        duration: durationSeconds,
        summary: transcript.slice(0, 1000),
        metadata: {
          elevenlabsConversationId: conversationId,
          elevenlabsAgentId: agentId,
          callType: body.call_type || 'inbound',
          rawEvent: body.event_type,
        },
      } as any,
    })

    // Deduct credits based on duration
    if (durationSeconds > 0 && tenantId) {
      await deductAICost(tenantId, {
        conversation: String(conversation.id),
        channel: 'voice',
        service: 'llm',
        provider: 'elevenlabs',
        duration: durationSeconds,
        audioSeconds: durationSeconds,
      })
    }

    // Update agent conversation stats (optional)
    await payload.update({
      collection: 'agents' as any,
      id: agent.id,
      data: {
        elevenlabsPhoneNumberId: body.phone_number_id || agent.elevenlabsPhoneNumberId,
      } as any,
    })

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[ElevenLabs Webhook] Error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
