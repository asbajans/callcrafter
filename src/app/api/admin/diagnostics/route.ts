import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

async function getCurrentUser() {
  const { cookies } = await import('next/headers');
  const { getUserIdFromToken } = await import('@/lib/auth');
  const cookieStore = await cookies();
  const token = cookieStore.get('payload-token')?.value;
  if (!token) return null;
  const userId = await getUserIdFromToken(token);
  if (!userId) return null;
  const payload = await getPayload({ config });
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 });
  if (!user) return null;
  return { id: user.id as number, email: user.email as string, role: user.role as string };
}

function createSilenceWav(): Buffer {
  const sampleRate = 16000;
  const bitsPerSample = 16;
  const numChannels = 1;
  const dataLength = sampleRate * 2;
  const buf = Buffer.alloc(44 + dataLength);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
  buf.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLength, 40);
  return buf;
}

async function testTts(url: string): Promise<{ status: string; detail: string; durationMs: number }> {
  const start = Date.now();
  try {
    const voice = 'en_US-lessac-medium';
    const res = await fetch(`${url}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'This is a test.', voice }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = body ? `HTTP ${res.status}: ${body.slice(0, 800)}` : `HTTP ${res.status}: ${res.statusText}`;
      return { status: 'error', detail, durationMs: Date.now() - start };
    }
    const contentType = res.headers.get('content-type') || '';
    const isAudio = contentType.includes('audio') || contentType.includes('octet-stream');
    const text = await res.text();
    if (text.length > 100 || isAudio) {
      return { status: 'healthy', detail: `Yanıt alındı (${(text.length / 1024).toFixed(1)} KB, ${contentType})`, durationMs: Date.now() - start };
    }
    return { status: 'degraded', detail: `Beklenmeyen yanıt: ${text.slice(0, 500)}`, durationMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', detail: err?.message || String(err), durationMs: Date.now() - start };
  }
}

async function testStt(url: string): Promise<{ status: string; detail: string; durationMs: number }> {
  const start = Date.now();
  try {
    const audioBuf = createSilenceWav();
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuf)], { type: 'audio/wav' });
    formData.append('audio_file', blob, 'silence.wav');
    const res = await fetch(`${url}/asr?output=json&language=en&task=transcribe`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = body ? `HTTP ${res.status}: ${body.slice(0, 800)}` : `HTTP ${res.status}: ${res.statusText}`;
      return { status: 'error', detail, durationMs: Date.now() - start };
    }
    const raw = await res.text();
    if (!raw) {
      return { status: 'error', detail: 'Boş yanıt alındı (JSON bekleniyordu)', durationMs: Date.now() - start };
    }
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return { status: 'error', detail: `JSON ayrıştırma hatası: ${raw.slice(0, 300)}`, durationMs: Date.now() - start };
    }
    const transcript = data?.text || data?.transcript || '';
    return { status: 'healthy', detail: `Transkript: "${transcript.slice(0, 100)}"`, durationMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', detail: err?.message || String(err), durationMs: Date.now() - start };
  }
}

async function testAiProvider(name: string, apiKey: string | undefined, testFn: () => Promise<string>): Promise<{ status: string; detail: string; durationMs: number }> {
  if (!apiKey) {
    return { status: 'not_configured', detail: 'API anahtarı bulunamadı', durationMs: 0 };
  }
  const start = Date.now();
  try {
    const detail = await testFn();
    return { status: 'healthy', detail, durationMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', detail: err?.message || String(err), durationMs: Date.now() - start };
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'super-admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const whisperUrl = process.env.WHISPER_SERVER_URL || 'http://whisper-server:9000';
  const piperUrl = process.env.PIPER_TTS_URL || 'http://piper-tts:5000';
  const testType = new URL(req.url).searchParams.get('type') || 'all';

  const results: Record<string, any> = {};

  if (testType === 'all' || testType === 'database') {
    try {
      const payload = await getPayload({ config });
      await payload.find({ collection: 'tenants', limit: 1, depth: 0 });
      results.database = { status: 'healthy', detail: 'PostgreSQL bağlantısı başarılı', durationMs: 0 };
    } catch (err: any) {
      results.database = { status: 'error', detail: err?.message || String(err), durationMs: 0 };
    }
  }

  if (testType === 'all' || testType === 'redis') {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const start = Date.now();
      try {
        const Redis = (await import('ioredis')).default;
        const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
        await redis.connect();
        await redis.ping();
        await redis.disconnect();
        results.redis = { status: 'healthy', detail: 'Redis bağlantısı başarılı', durationMs: Date.now() - start };
      } catch (err: any) {
        results.redis = { status: 'error', detail: err?.message || String(err), durationMs: Date.now() - start };
      }
    } else {
      results.redis = { status: 'not_configured', detail: 'REDIS_URL tanımlanmamış', durationMs: 0 };
    }
  }

  if (testType === 'all' || testType === 'tts') {
    results.tts = await testTts(piperUrl);
  }

  if (testType === 'all' || testType === 'stt') {
    results.stt = await testStt(whisperUrl);
  }

  if (testType === 'all' || testType === 'ai') {
    results.openai = await testAiProvider('OpenAI', process.env.OPENAI_API_KEY, async () => {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${res.statusText}`);
      const data = await res.json();
      return `${(data.data?.length || 0)} model listelendi`;
    });

    results.anthropic = await testAiProvider('Anthropic', process.env.ANTHROPIC_API_KEY, async () => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 10, messages: [{ role: 'user', content: 'test' }] }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${res.statusText}`);
      return 'API yanıt verdi';
    });

    results.stripe = await testAiProvider('Stripe', process.env.STRIPE_SECRET_KEY, async () => {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Stripe API ${res.status}: ${res.statusText}`);
      const data = await res.json();
      return `Bakiye: ${(data.available?.[0]?.amount || 0) / 100} ${data.available?.[0]?.currency || 'USD'}`;
    });

    const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    results.twilio = {
      status: twilioConfigured ? 'configured' : 'not_configured',
      detail: twilioConfigured ? 'Twilio kimlik bilgileri mevcut' : 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN tanımlanmamış',
      durationMs: 0,
    };
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}
