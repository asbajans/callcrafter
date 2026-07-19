import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { getUserIdFromToken } from '@/lib/auth'

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

export async function GET() {
  const appId = process.env.WHATSAPP_APP_ID
  const configId = process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID
  if (!appId || !configId) {
    return NextResponse.json({ error: 'WHATSAPP_APP_ID and WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID must be set' }, { status: 500 })
  }
  return NextResponse.json({ appId, configId })
}
