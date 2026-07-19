import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { getUserIdFromToken } from '@/lib/auth'
import { WhatsAppAdapter } from '@/channels/whatsapp/WhatsAppAdapter'

async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null
  const userId = await getUserIdFromToken(token)
  if (!userId) return null
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
  if (!user) return null
  return {
    id: user.id as number,
    email: user.email as string,
    role: user.role as string,
    tenantId: user.tenant ? (typeof user.tenant === 'object' ? (user.tenant as any).id : user.tenant) : undefined,
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json()
  const { wabaId, phoneNumberId, displayPhoneNumber, name } = body

  if (!wabaId || !phoneNumberId) {
    return NextResponse.json({ error: 'wabaId and phoneNumberId are required' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Check if account with this phoneNumberId already exists
  const existing = await payload.find({
    collection: 'whatsapp-accounts' as any,
    where: { phoneNumberId: { equals: phoneNumberId } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    return NextResponse.json({ error: 'This number is already connected' }, { status: 409 })
  }

  // Create the account
  const account = await payload.create({
    collection: 'whatsapp-accounts' as any,
    data: {
      tenant: user.tenantId,
      name: name || displayPhoneNumber || `WA ${phoneNumberId}`,
      connectionType: 'cloud_api',
      phoneNumberId,
      businessAccountId: wabaId,
      displayPhoneNumber: displayPhoneNumber || null,
      isActive: true,
    } as any,
  })

  // Register the number
  try {
    const adapter = new WhatsAppAdapter({
      phoneNumberId,
      businessAccountId: wabaId,
    })
    await adapter.registerNumber('000000')
  } catch (err: any) {
    console.warn('[EmbeddedSignup] Registration failed (non-fatal):', err.message)
  }

  // Subscribe webhook
  try {
    const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN
    if (token) {
      await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch (err: any) {
    console.warn('[EmbeddedSignup] Webhook subscribe failed (non-fatal):', err.message)
  }

  return NextResponse.json({ success: true, account })
}
