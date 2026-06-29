import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../../payload.config'
import OpenAI from 'openai'
import { deductAICost } from '@/billing/creditMiddleware'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = req.cookies
    const token = cookieStore.get('payload-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    let user: any
    try {
      const result = await payload.auth({ headers: new Headers({ Cookie: `payload-token=${token}` }) })
      if (!result.user) throw new Error('Invalid token')
      user = result.user
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = user.tenant
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 })
    }

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey })
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: audioFile.type || 'audio/webm' })
    const file = new File([blob], 'audio.webm', { type: audioFile.type || 'audio/webm' })

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      response_format: 'text',
    })

    const audioSeconds = Math.ceil(audioBuffer.length / 16000 / 2)
    await deductAICost(tenantId, {
      channel: 'voice',
      service: 'stt',
      provider: 'openai',
      audioSeconds,
    })

    return NextResponse.json({ text: transcription })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
