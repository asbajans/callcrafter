import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const postgres = (await import('postgres')).default
    const sql = postgres(process.env.DATABASE_URI || '')

    // 1. Add tts_provider column
    await sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "tts_provider" varchar DEFAULT 'auto';`

    // 2. Convert ai_providers models from string array to object array
    await sql`
      UPDATE "ai_providers"
      SET "models" = (
        SELECT jsonb_agg(
          CASE
            WHEN value ? 'modelId' THEN value
            ELSE jsonb_build_object('name', value->>0, 'modelId', value->>0, 'creditCost', 1)
          END
        )
        FROM jsonb_array_elements(("models"::text)::jsonb) AS value
      )
      WHERE "models" IS NOT NULL
        AND "models"::text LIKE '[%"%'
    `

    // 3. Fix opentouur provider type (has OpenRouter key but type=openai)
    await sql`
      UPDATE "ai_providers"
      SET "provider_type" = 'openrouter'
      WHERE "name" = 'opentouur' AND "apikey" LIKE 'sk-or-v1%'
    `

    await sql.end()

    return NextResponse.json({ ok: true, message: 'All fixes applied successfully' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
