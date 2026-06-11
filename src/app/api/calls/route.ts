import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { agentId, phoneNumber, tenantId } = await req.json();

    if (!agentId || !phoneNumber) {
      return NextResponse.json({ error: 'agentId and phoneNumber are required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');

    const wsServerUrl = process.env.WS_SERVER_URL || 'http://ws-server:8080';

    const response = await fetch(`${wsServerUrl}/twilio/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader || '' },
      body: JSON.stringify({ agentId, phoneNumber, tenantId }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Call initiation error:', error);
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}
