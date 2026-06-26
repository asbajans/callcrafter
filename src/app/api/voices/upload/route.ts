import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    const piperUrl = process.env.PIPER_TTS_URL || 'http://piper-tts:5000';
    const forward = new FormData();
    forward.append('file', file, file.name);
    const voiceId = formData.get('voiceId');
    if (voiceId) forward.append('voiceId', voiceId as string);

    const res = await fetch(`${piperUrl}/upload`, {
      method: 'POST',
      body: forward,
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Upload failed' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
