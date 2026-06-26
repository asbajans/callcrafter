import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Mark 20260623_200000 as completed to prevent it from running again.
  // It conflicts with 20260623_220000 (different column naming) and its DROP TABLE would destroy data.
  await db.execute(sql`
    INSERT INTO "payload_migrations" ("name", "batch", "created_at", "updated_at")
    SELECT '20260623_200000', COALESCE((SELECT MAX("batch") FROM "payload_migrations"), 1), NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM "payload_migrations" WHERE "name" = '20260623_200000');
  `)

  // Drop FK constraint from original voice relationship (agents.voice_id → voice_configs)
  await db.execute(sql`ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_voice_id_voice_configs_id_fk";`)
  await db.execute(sql`DROP INDEX IF EXISTS "agents_voice_idx";`)

  // Add new text columns for Piper voice IDs
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice" varchar;`)
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice_name" varchar;`)

  // Make old voice_id nullable (no longer required)
  await db.execute(sql`ALTER TABLE "agents" ALTER COLUMN "voice_id" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "voice_name";`)
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "voice";`)
  await db.execute(sql`ALTER TABLE "agents" ALTER COLUMN "voice_id" SET NOT NULL;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "agents_voice_idx" ON "agents" USING btree ("voice_id");`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_voice_id_voice_configs_id_fk') THEN ALTER TABLE "agents" ADD CONSTRAINT "agents_voice_id_voice_configs_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voice_configs"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)
}
