import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sql } = await import('@payloadcms/db-postgres')

    const postgres = (await import('postgres')).default
    const sql2 = postgres(process.env.DATABASE_URI || '')

    await sql2`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "tts_provider" varchar DEFAULT 'auto';`

    await sql2.end()

    return NextResponse.json({ ok: true, message: 'tts_provider column added' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
