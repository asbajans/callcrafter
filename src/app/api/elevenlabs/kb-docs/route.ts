import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ElevenLabsService } from '@/lib/ElevenLabsService'

async function getElevenLabsService(): Promise<ElevenLabsService | null> {
  const envKey = process.env.ELEVENLABS_API_KEY
  if (envKey) return new ElevenLabsService(envKey)
  try {
    const payload = await getPayload({ config })
    const providers = await payload.find({
      collection: 'ai-providers' as any,
      where: { name: { like: 'elevenlabs' } },
      limit: 1, depth: 0,
    })
    const p = providers.docs[0] as any
    if (p?.apiKey) return new ElevenLabsService(p.apiKey)
    const all = await payload.find({ collection: 'ai-providers' as any, limit: 50, depth: 0 })
    const found = (all.docs as any[]).find((x: any) => x.apiKey && typeof x.apiKey === 'string' && x.apiKey.startsWith('sk_'))
    if (found) return new ElevenLabsService(found.apiKey)
    return null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const { cookies } = await import('next/headers')
    const { getUserIdFromToken } = await import('@/lib/auth')
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = await getUserIdFromToken(token)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const el = await getElevenLabsService()
    if (!el) return NextResponse.json({ documents: [] })

    const data = await el.listKnowledgeBaseDocuments()
    return NextResponse.json({ documents: data.documents || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, documents: [] })
  }
}
