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
  return { id: user.id as number, email: user.email as string, role: user.role as string, tenantId: user.tenant ? (typeof user.tenant === 'object' ? (user.tenant as any).id : user.tenant) : undefined }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const payload = await getPayload({ config })

  const account = await payload.findByID({ collection: 'whatsapp-accounts' as any, id })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (account.connectionType !== 'cloud_api') {
    return NextResponse.json({ error: 'Only Cloud API accounts can be registered' }, { status: 400 })
  }

  const accessToken = account.accessToken || process.env.WHATSAPP_SYSTEM_USER_TOKEN
  if (!accessToken || !account.phoneNumberId) {
    return NextResponse.json({ error: 'Account missing phoneNumberId or accessToken' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const pin = body.pin || '000000'

  try {
    const adapter = new WhatsAppAdapter({
      accessToken,
      phoneNumberId: account.phoneNumberId,
      webhookVerifyToken: account.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    })

    const result = await adapter.registerNumber(pin)

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error('[Register] Failed to register number:', err)
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 })
  }
}
