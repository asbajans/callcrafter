import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get('voice') || 'en_US-lessac-medium';
  const text = req.nextUrl.searchParams.get('text') || 'This is a test of the voice.';
  const piperUrl = process.env.PIPER_TTS_URL || 'http://piper-tts:5000';

  try {
    const res = await fetch(`${piperUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
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
