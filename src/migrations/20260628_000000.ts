import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Emergency fix: ensure agents.provider_id column exists.
  // The 20260627_000000 migration may have been marked completed without adding
  // this column (if RENAME COLUMN failed on missing tables in a previous attempt).

  // -- agents.provider: add relationship column (idempotent) --
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "provider_id" integer;`)

  // -- agents.provider: add FK safely --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'provider_id')
         AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_provider_id_ai_providers_fk') THEN
        ALTER TABLE "agents" ADD CONSTRAINT "agents_provider_id_ai_providers_fk"
          FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)

  // -- agents.model: enum -> varchar (idempotent) --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'model'
                     AND data_type = 'USER-DEFINED') THEN
        ALTER TABLE "agents" ALTER COLUMN "model" TYPE varchar;
        ALTER TABLE "agents" ALTER COLUMN "model" SET DEFAULT 'gpt-4o';
      END IF;
    END $$;
  `)

  // -- Ensure voice and voice_name columns exist (in case 20260626_160000 also failed) --
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice" varchar;`)
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice_name" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_provider_id_ai_providers_fk";`)
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "provider_id";`)
}
