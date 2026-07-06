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
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as any
      const { createRequire } = await import('module')
      const req = createRequire(import.meta.url)
      pdfjsLib.GlobalWorkerOptions.workerSrc = req.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise
      const pages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map((item: any) => item.str).join(' '))
      }
      textContent = pages.join('\n')
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
