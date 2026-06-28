import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Add column and FK to payload_locked_documents_rels if missing
// Guards every operation: table may not exist, column may already exist, FK may already exist
const addLockRelColumn = (tableCol: string, constraint: string, refTable: string) => sql`
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
      EXECUTE 'ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "${sql.raw(tableCol)}" integer';
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payload_locked_documents_rels' AND column_name = '${sql.raw(tableCol)}')
         AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${sql.raw(constraint)}')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${sql.raw(refTable)}') THEN
        EXECUTE format('ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES "public".%I(id) ON DELETE cascade ON UPDATE no action',
          '${sql.raw(constraint)}', '${sql.raw(tableCol)}', '${sql.raw(refTable)}');
      END IF;
    END IF;
  END $$;
`

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // PHASE 1: Add missing columns to payload_locked_documents_rels
  // The initial migration (20260611_151745) created this table with only the original 15 collections.
  // Collections added later (WhatsApp, credits, AI providers) never got their columns.
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "whatsapp_accounts_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "whatsapp_conversations_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "whatsapp_messages_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "credit_packages_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tenant_credits_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "credit_transactions_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "usage_logs_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "ai_providers_id" integer;
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tenant_provider_access_id" integer;
      END IF;
    END $$;
  `)

  // FK constraints for new locked-document rels columns
  await db.execute(addLockRelColumn('whatsapp_accounts_id', 'payload_locked_documents_rels_whatsapp_accounts_fk', 'whatsapp_accounts'))
  await db.execute(addLockRelColumn('whatsapp_conversations_id', 'payload_locked_documents_rels_whatsapp_conversations_fk', 'whatsapp_conversations'))
  await db.execute(addLockRelColumn('whatsapp_messages_id', 'payload_locked_documents_rels_whatsapp_messages_fk', 'whatsapp_messages'))
  await db.execute(addLockRelColumn('credit_packages_id', 'payload_locked_documents_rels_credit_packages_fk', 'credit_packages'))
  await db.execute(addLockRelColumn('tenant_credits_id', 'payload_locked_documents_rels_tenant_credits_fk', 'tenant_credits'))
  await db.execute(addLockRelColumn('credit_transactions_id', 'payload_locked_documents_rels_credit_transactions_fk', 'credit_transactions'))
  await db.execute(addLockRelColumn('usage_logs_id', 'payload_locked_documents_rels_usage_logs_fk', 'usage_logs'))
  await db.execute(addLockRelColumn('ai_providers_id', 'payload_locked_documents_rels_ai_providers_fk', 'ai_providers'))
  await db.execute(addLockRelColumn('tenant_provider_access_id', 'payload_locked_documents_rels_tenant_provider_access_fk', 'tenant_provider_access'))

  // PHASE 2: Ensure agents.provider_id column exists
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "provider_id" integer;`)

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

  // -- Ensure voice and voice_name columns exist --
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice" varchar;`)
  await db.execute(sql`ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice_name" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_provider_id_ai_providers_fk";`)
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "provider_id";`)
}
