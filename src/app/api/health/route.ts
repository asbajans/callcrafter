import { NextResponse } from 'next/server';
import { appLogger } from '@/lib/logger';

export async function GET() {
  const checks: Record<string, string> = {};
  let allHealthy = true;

  // Check database connectivity
  try {
    const { getPayload } = await import('payload');
    const config = await import('../../../../payload.config').then((m) => m.default);
    const payload = await getPayload({ config: config as any });
    await payload.find({ collection: 'tenants', limit: 1, depth: 0 });
    checks.database = 'connected';
  } catch (error) {
    checks.database = 'disconnected';
    allHealthy = false;
    appLogger.error('Health check: database connection failed', error instanceof Error ? error : undefined);
  }

  // Check Redis connectivity
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await redis.connect();
      await redis.ping();
      await redis.disconnect();
      checks.redis = 'connected';
    } catch (error: unknown) {
      checks.redis = 'disconnected';
      allHealthy = false;
      appLogger.warn('Health check: Redis connection failed', { error: String(error) });
    }
  } else {
    checks.redis = 'not_configured';
  }

  // Check AI API keys
  checks.openai = process.env.OPENAI_API_KEY ? 'configured' : 'not_configured';
  checks.anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured';
  checks.elevenlabs = process.env.ELEVENLABS_API_KEY ? 'configured' : 'not_configured';

  // Check Twilio
  checks.twilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? 'configured' : 'not_configured';

  // Check Stripe
  checks.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured';

  const health = {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '0.1.0',
    uptime: process.uptime(),
    services: checks,
  };

  return NextResponse.json(health, {
    status: allHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
