import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "pitch" numeric DEFAULT 0;`)
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "rate" numeric DEFAULT 0;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "pitch";`)
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "rate";`)
}
