import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ElevenLabsService'

async function getElevenLabsService(): Promise<ElevenLabsService | null> {
  const envKey = process.env.ELEVENLABS_API_KEY
  if (envKey) return new ElevenLabsService(envKey)
  return null
}

export async function POST(req: NextRequest) {
  try {
    const el = await getElevenLabsService()
    if (!el) return NextResponse.json({ error: 'ElevenLabs API anahtarı bulunamadı' }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docName = (formData.get('name') as string) || file?.name || 'Untitled'

    if (!file) return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name.toLowerCase()

    let textContent: string

    if (fileName.endsWith('.pdf')) {
      const mod: any = await import('pdf-parse')
      const parser = new mod.PDFParse({})
      await parser.load(buffer)
      const pages = await parser.getText()
      textContent = (pages || []).map((p: any) => p.text || '').join('\n')
    } else {
      textContent = buffer.toString('utf-8')
    }

    if (!textContent.trim()) {
      return NextResponse.json({ error: 'Dosyadan metin çıkarılamadı' }, { status: 400 })
    }

    const result = await el.createKnowledgeBaseFromText(textContent, docName)

    return NextResponse.json({ success: true, kbDocId: result.id, name: result.name })
  } catch (err: any) {
    return NextResponse.json({ error: `Yükleme hatası: ${err.message}` }, { status: 500 })
  }
}
