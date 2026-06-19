import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/rate-limiter';
import { appLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, phoneNumber, tenantId } = body;

    if (!agentId || !phoneNumber) {
      appLogger.warn('Missing required fields for call initiation', { agentId, phoneNumber });
      return NextResponse.json({ error: 'agentId and phoneNumber are required' }, { status: 400 });
    }

    const rateLimiter = new RateLimiter();
    const rateCheck = await rateLimiter.checkLimit(
      tenantId || 'default',
      agentId || 'system',
      50,
      60_000,
    );

    if (!rateCheck.allowed) {
      appLogger.warn('Rate limit exceeded for calls', { tenantId, agentId });
      return NextResponse.json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateCheck.reset - Date.now()) / 1000),
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
          'X-RateLimit-Reset': String(rateCheck.reset),
        },
      });
    }

    const authHeader = req.headers.get('authorization');

    appLogger.info('Initiating call', { agentId, phoneNumber, tenantId });

    const wsServerUrl = process.env.WS_SERVER_URL || 'http://ws-server:8080';
    const response = await fetch(`${wsServerUrl}/twilio/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader || '' },
      body: JSON.stringify({ agentId, phoneNumber, tenantId }),
    });

    const data = await response.json();

    if (!response.ok) {
      appLogger.warn('Call initiation rejected by ws-server', { status: response.status, data });
    } else {
      appLogger.info('Call initiated successfully', { agentId, phoneNumber });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    appLogger.error('Call initiation failed', error instanceof Error ? error : undefined, { error: message });
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}