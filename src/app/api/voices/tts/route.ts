import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

async function elevenLabsTTS(voiceId: string, text: string, apiKey: string): Promise<NextResponse> {
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!cleanText) {
    return NextResponse.json({ error: 'No speakable text after sanitization' }, { status: 400 });
  }

  const DEFAULT_ELEVENLABS_VOICE = '21m00Tcm4TlvDq8ikWAM';
  const isPiperVoice = /^[a-z]{2}_[A-Z]{2}/.test(voiceId);
  const effectiveVoice = (!voiceId || isPiperVoice) ? DEFAULT_ELEVENLABS_VOICE : voiceId;

  const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${effectiveVoice}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: cleanText,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`ElevenLabs TTS error (${res.status}): ${errBody.slice(0, 500)}`);
    return NextResponse.json({ error: errBody || 'ElevenLabs TTS failed' }, { status: res.status });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  });
}

async function piperTTS(voiceId: string, text: string): Promise<NextResponse> {
  const piperUrl = process.env.PIPER_TTS_URL || 'http://piper-tts:5000';
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!cleanText) {
    return NextResponse.json({ error: 'No speakable text after sanitization' }, { status: 400 });
  }

  const res = await fetch(`${piperUrl}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText, voice: voiceId || undefined }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`Piper TTS error (${res.status}): ${errBody.slice(0, 500)}`);
    return NextResponse.json({ error: errBody || 'Piper TTS failed' }, { status: res.status });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function GET(req: NextRequest) {
  const voiceId = req.nextUrl.searchParams.get('voice') || '';
  const text = req.nextUrl.searchParams.get('text') || '';
  const provider = req.nextUrl.searchParams.get('provider') || 'auto';
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  try {
    if (provider === 'elevenlabs' || (provider === 'auto' && elevenLabsKey)) {
      if (!elevenLabsKey) {
        return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 400 });
      }
      return await elevenLabsTTS(voiceId, text, elevenLabsKey);
    }
    return await piperTTS(voiceId, text);
  } catch (err: any) {
    console.error('TTS error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
