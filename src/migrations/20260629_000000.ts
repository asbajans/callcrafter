import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add tts_provider column to agents table
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "tts_provider" varchar DEFAULT 'auto';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "tts_provider";`)
}
