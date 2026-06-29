-- Fix: Add missing payload_locked_documents_rels columns
-- Run on the database: docker exec -i postgres psql -U postgres -d callcrafter_saas < scripts/fix-missing-columns.sql

-- Phase 1: Add missing columns to payload_locked_documents_rels
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "whatsapp_accounts_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "whatsapp_conversations_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "whatsapp_messages_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "credit_packages_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tenant_credits_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "credit_transactions_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "usage_logs_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "ai_providers_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tenant_provider_access_id" integer;

-- Phase 2: Add FK constraints (only if tables exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_accounts') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whatsapp_accounts_fk" FOREIGN KEY ("whatsapp_accounts_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_conversations') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whatsapp_conversations_fk" FOREIGN KEY ("whatsapp_conversations_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_messages') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whatsapp_messages_fk" FOREIGN KEY ("whatsapp_messages_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_packages') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_credit_packages_fk" FOREIGN KEY ("credit_packages_id") REFERENCES "public"."credit_packages"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_credits') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenant_credits_fk" FOREIGN KEY ("tenant_credits_id") REFERENCES "public"."tenant_credits"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_credit_transactions_fk" FOREIGN KEY ("credit_transactions_id") REFERENCES "public"."credit_transactions"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_logs') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_usage_logs_fk" FOREIGN KEY ("usage_logs_id") REFERENCES "public"."usage_logs"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_providers') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_providers_fk" FOREIGN KEY ("ai_providers_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_provider_access') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenant_provider_access_fk" FOREIGN KEY ("tenant_provider_access_id") REFERENCES "public"."tenant_provider_access"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

-- Phase 3: Add agents.provider_id column (for admin agents page fix)
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "provider_id" integer;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice" varchar;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "voice_name" varchar;

-- Phase 4: Convert agents.model from enum to varchar
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'model' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE "agents" ALTER COLUMN "model" TYPE varchar;
    ALTER TABLE "agents" ALTER COLUMN "model" SET DEFAULT 'gpt-4o';
  END IF;
END $$;
