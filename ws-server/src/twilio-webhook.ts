import { Request, Response } from 'express';

export function handleTwilioVoiceWebhook(req: Request, res: Response) {
  const { CallSid, From, To, AccountSid } = req.body;
  console.log(`📞 Incoming call: ${From} -> ${To} (SID: ${CallSid})`);

  const wsUrl = `${process.env.WS_PUBLIC_URL || 'wss://your-domain.com'}/?call=${CallSid}&from=${encodeURIComponent(From || '')}&to=${encodeURIComponent(To || '')}`;

  // TwiML response: Connect to Media Streams
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callSid" value="${CallSid}"/>
      <Parameter name="from" value="${From}"/>
      <Parameter name="to" value="${To}"/>
    </Stream>
  </Connect>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
}
