import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // PHASE 1: Convert AI provider models from string array to object array
  // Old: ["gpt-5-nano"] → New: [{"name":"GPT-5 Nano","modelId":"gpt-5-nano","creditCost":1}]
  await db.execute(sql`
    UPDATE "ai_providers"
    SET "models" = (
      SELECT jsonb_agg(
        CASE
          WHEN value ? 'modelId' THEN value
          ELSE jsonb_build_object('name', value->>0, 'modelId', value->>0, 'creditCost', 1)
        END
      )
      FROM jsonb_array_elements("models"::jsonb) AS value
    )
    WHERE "models" IS NOT NULL
      AND "models"::text LIKE '[%"%'
  `)

  // PHASE 2: Fix providerType for opentouur (has OpenRouter key but type=openai)
  await db.execute(sql`
    UPDATE "ai_providers"
    SET "provider_type" = 'openrouter'
    WHERE "name" = 'opentouur'
      AND "apikey" LIKE 'sk-or-v1%'
  `)

  // PHASE 3: Fix providerType for Openai (has OpenAI key but type=openai, ensure correct)
  await db.execute(sql`
    UPDATE "ai_providers"
    SET "provider_type" = 'openai'
    WHERE "name" = 'Openai'
      AND "apikey" LIKE 'sk-proj%'
  `)

  // PHASE 4: Add tts_provider column to agents table
  await db.execute(sql`
    ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "tts_provider" varchar DEFAULT 'auto';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "tts_provider";`)
}
