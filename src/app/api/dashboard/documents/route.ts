import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ElevenLabsService } from '@/lib/ElevenLabsService'

async function getCurrentUser() {
  const { cookies } = await import('next/headers')
  const { getUserIdFromToken } = await import('@/lib/auth')
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null
  const userId = await getUserIdFromToken(token)
  if (!userId) return null
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
  if (!user) return null
  const tenantId = (user as any).tenant?.id || (user as any).tenant || null
  return { id: user.id as number, email: user.email as string, role: user.role as string, tenantId: tenantId as number | null }
}

async function getElevenLabsService(): Promise<ElevenLabsService | null> {
  const envKey = process.env.ELEVENLABS_API_KEY
  if (envKey) return new ElevenLabsService(envKey)
  return null
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !user.tenantId) return NextResponse.json({ documents: [] })

    const payload = await getPayload({ config })
    const docs = await payload.find({
      collection: 'training-docs' as any,
      where: { tenant: { equals: user.tenantId } },
      sort: '-createdAt',
      limit: 100,
      depth: 0,
    })

    const documents = (docs.docs || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.type || 'txt',
      elevenlabsKbDocId: d.elevenlabsKbDocId || null,
      agentName: d.agent?.name || null,
      agentId: d.agent?.id || null,
      createdAt: d.createdAt,
    }))

    return NextResponse.json({ documents })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, documents: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const el = await getElevenLabsService()
    if (!el) return NextResponse.json({ error: 'ElevenLabs bağlantısı kurulamadı' }, { status: 400 })

    let textContent: string | null = null
    let docName = 'Untitled'
    let docType = 'txt'
    let agentId: string | null = null

    const ct = req.headers.get('content-type') || ''
    if (ct.includes('multipart/form-data') || ct.includes('form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const textField = formData.get('text') as string | null
      const name = formData.get('name') as string | null
      agentId = formData.get('agentId') as string | null
      if (name) docName = name

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileName = file.name.toLowerCase()
        if (fileName.endsWith('.pdf')) {
          docType = 'pdf'
          try {
            const kbDoc = await el.createKnowledgeBaseFromFile(buffer, file.name)
            textContent = `[PDF uploaded to ElevenLabs KB: ${kbDoc.id}]`
            docName = file.name
            const payload = await getPayload({ config })
            const docData: any = {
              tenant: user.tenantId,
              name: file.name,
              type: docType,
              content: `[PDF: ${file.name}]`,
              elevenlabsKbDocId: kbDoc.id,
              status: 'ready',
            }
            if (agentId) docData.agent = parseInt(agentId, 10)
            const created = await payload.create({
              collection: 'training-docs' as any,
              data: docData,
            })
            return NextResponse.json({
              success: true,
              document: {
                id: (created as any).id,
                name: file.name,
                type: docType,
                elevenlabsKbDocId: kbDoc.id,
                agentId: agentId ? parseInt(agentId, 10) : null,
                createdAt: (created as any).createdAt,
              },
            })
          } catch (err: any) {
            return NextResponse.json({ error: `ElevenLabs yükleme hatası: ${err.message}` }, { status: 502 })
          }
        } else {
          textContent = buffer.toString('utf-8')
          if (fileName.endsWith('.csv')) docType = 'csv'
          else if (fileName.endsWith('.json')) docType = 'json'
          else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) docType = 'html'
        }
        if (!docName || docName === 'Untitled') docName = file.name
      } else if (textField?.trim()) {
        textContent = textField
        docType = formData.get('type') as string || 'txt'
      }
    }

    if (!textContent?.trim()) return NextResponse.json({ error: 'Metin içeriği gerekli' }, { status: 400 })

    const kbResult = await el.createKnowledgeBaseFromText(textContent, docName)

    const payload = await getPayload({ config })
    const docData: any = {
      tenant: user.tenantId,
      name: docName,
      type: docType,
      content: textContent,
      elevenlabsKbDocId: kbResult.id,
      status: 'ready',
    }
    if (agentId) {
      docData.agent = parseInt(agentId, 10)
    }
    const created = await payload.create({
      collection: 'training-docs' as any,
      data: docData,
    })

    return NextResponse.json({
      success: true,
      document: {
        id: (created as any).id,
        name: docName,
        type: docType,
        elevenlabsKbDocId: kbResult.id,
        agentId: agentId ? parseInt(agentId, 10) : null,
        createdAt: (created as any).createdAt,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: `Yükleme hatası: ${err.message}` }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const docId = searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

    const payload = await getPayload({ config })
    const doc = await payload.findByID({ collection: 'training-docs' as any, id: docId, depth: 0 }) as any
    if (!doc) return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 })
    if (doc.tenant?.id !== user.tenantId && doc.tenant !== user.tenantId) {
      return NextResponse.json({ error: 'Bu belgeye erişim izniniz yok' }, { status: 403 })
    }

    if (doc.elevenlabsKbDocId) {
      const el = await getElevenLabsService()
      if (el) {
        try { await el.deleteKnowledgeBaseDocument(doc.elevenlabsKbDocId) } catch {}
      }
    }

    await payload.delete({ collection: 'training-docs' as any, id: docId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
