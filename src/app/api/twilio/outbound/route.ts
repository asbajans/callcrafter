import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid') || 'unknown';

  const wsUrl = `${process.env.WS_PUBLIC_URL || 'wss://your-domain.com'}/?call=${callSid}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callSid" value="${callSid}"/>
    </Stream>
  </Connect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
