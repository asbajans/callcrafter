import { NextResponse } from 'next/server'
import { DEFAULT_VOICES, EDGE_TTS_VOICES } from '@/lib/voices'

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1'

export async function GET() {
  const piperVoices = DEFAULT_VOICES.map(v => ({
    id: v.id,
    name: v.name,
    language: v.language,
    gender: v.gender || null,
    provider: 'piper' as const,
  }))

  const edgeTTSVoices = EDGE_TTS_VOICES.map(v => ({
    id: v.id,
    name: v.name,
    language: v.language,
    gender: v.gender || null,
    provider: 'edge-tts' as const,
  }))

  let elevenLabsVoices: any[] = []
  let hasElevenLabs = false
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (apiKey) {
    try {
      const res = await fetch(`${ELEVENLABS_API}/voices`, {
        headers: { 'xi-api-key': apiKey },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        elevenLabsVoices = (data.voices || []).map((v: any) => ({
          id: v.voice_id,
          name: v.name,
          language: null,
          gender: null,
          previewUrl: v.preview_url || null,
          provider: 'elevenlabs' as const,
        }))
        hasElevenLabs = elevenLabsVoices.length > 0
      }
    } catch {}
  }

  return NextResponse.json({
    voices: [...edgeTTSVoices, ...piperVoices, ...elevenLabsVoices],
    defaultVoice: 'tr-TR-EmelNeural',
    hasElevenLabs,
    hasEdgeTTS: true,
  })
}
