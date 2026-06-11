import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const callId =
      body.call_id || body.callId || body.caller_id || ''
    const from =
      body.caller_id || body.clid || body.from || ''
    const to = body.called_did || body.to || ''
    const event = body.event || body.status || ''

    console.log(`Zadarma webhook: event=${event}, callId=${callId}, from=${from}, to=${to}`)

    if (event === 'NOTIFY_INTERNAL_START' || event === 'START') {
      if (!callId) {
        return NextResponse.json({ error: 'callId required' }, { status: 400 })
      }

      const wsServerUrl = process.env.WS_SERVER_URL || 'http://ws-server:8080'
      const authHeader = req.headers.get('authorization') || ''

      const response = await fetch(`${wsServerUrl}/zadarma/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ callId, from, to }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Zadarma call forward error: ${errorText}`)
        return NextResponse.json({ error: 'Failed to forward call' }, { status: 502 })
      }

      const data = await response.json()
      return NextResponse.json(data)
    }

    if (event === 'NOTIFY_INTERNAL_END' || event === 'END' || event === 'DISCONNECT') {
      const wsServerUrl = process.env.WS_SERVER_URL || 'http://ws-server:8080'

      await fetch(`${wsServerUrl}/zadarma/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      }).catch(() => {})
    }

    return NextResponse.json({ status: 'received' })
  } catch (error) {
    console.error('Zadarma webhook error:', error)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}
