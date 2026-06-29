import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get('voice') || 'en_US-lessac-medium';
  const text = req.nextUrl.searchParams.get('text') || 'This is a test of the voice.';
  const piperUrl = process.env.PIPER_TTS_URL || 'http://piper-tts:5000';

  try {
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) {
      return NextResponse.json({ error: 'No speakable text after sanitization' }, { status: 400 })
    }

    const res = await fetch(`${piperUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`Piper TTS error (${res.status}): ${errBody.slice(0, 500)}`);
      return NextResponse.json({ error: errBody || 'TTS failed' }, { status: res.status });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
