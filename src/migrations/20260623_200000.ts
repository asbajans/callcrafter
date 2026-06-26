import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create enum types
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_credit_transactions_type') THEN CREATE TYPE "public"."enum_credit_transactions_type" AS ENUM('purchase', 'manual_add', 'usage', 'expired', 'refund', 'adjustment'); END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_credit_transactions_source') THEN CREATE TYPE "public"."enum_credit_transactions_source" AS ENUM('stripe', 'admin', 'usage', 'system'); END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_usage_logs_channel') THEN CREATE TYPE "public"."enum_usage_logs_channel" AS ENUM('voice', 'whatsapp', 'instagram', 'web'); END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_usage_logs_service') THEN CREATE TYPE "public"."enum_usage_logs_service" AS ENUM('stt', 'tts', 'llm'); END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_usage_logs_provider') THEN CREATE TYPE "public"."enum_usage_logs_provider" AS ENUM('openai', 'anthropic', 'gemini', 'openrouter', 'self-hosted', 'custom'); END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ai_providers_provider') THEN CREATE TYPE "public"."enum_ai_providers_provider" AS ENUM('openai', 'anthropic', 'gemini', 'openrouter', 'ollama', 'custom'); END IF; END $$;`)

  // Create tables
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "credit_packages" ("id" serial PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "credits" numeric NOT NULL, "price" numeric NOT NULL, "is_active" boolean DEFAULT true, "sort_order" numeric, "stripe_price_id" varchar, "stripe_product_id" varchar, "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL);`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "tenant_credits" ("id" serial PRIMARY KEY NOT NULL, "tenant_id" integer NOT NULL, "balance" numeric DEFAULT 0, "total_purchased" numeric DEFAULT 0, "total_used" numeric DEFAULT 0, "total_expired" numeric DEFAULT 0, "monthly_limit" numeric, "earliest_expiry" timestamp(3) with time zone, "last_top_up_at" timestamp(3) with time zone, "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL);`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "credit_transactions" ("id" serial PRIMARY KEY NOT NULL, "tenant_id" integer NOT NULL, "type" "enum_credit_transactions_type" NOT NULL, "amount" numeric NOT NULL, "balance_before" numeric DEFAULT 0, "balance_after" numeric DEFAULT 0, "source" "enum_credit_transactions_source" DEFAULT 'admin', "description" varchar, "stripe_payment_intent_id" varchar, "expires_at" timestamp(3) with time zone, "credit_package_id" integer, "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL);`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "usage_logs" ("id" serial PRIMARY KEY NOT NULL, "tenant_id" integer, "conversation" varchar, "channel" "enum_usage_logs_channel" DEFAULT 'voice', "service" "enum_usage_logs_service" DEFAULT 'llm', "provider" "enum_usage_logs_provider" DEFAULT 'openai', "model" varchar, "duration" numeric, "tokens" numeric, "characters" numeric, "audio_seconds" numeric, "credits_used" numeric DEFAULT 0, "input_preview" varchar, "metadata" jsonb, "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL);`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "ai_providers" ("id" serial PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "provider" "enum_ai_providers_provider" NOT NULL, "api_key" varchar NOT NULL, "base_url" varchar, "models" jsonb, "default_model" varchar, "credit_cost_per_token" numeric DEFAULT 0.00001, "credit_cost_per_char" numeric DEFAULT 0.001, "credit_cost_per_second" numeric DEFAULT 0.01, "is_active" boolean DEFAULT true, "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL);`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "tenant_provider_access" ("id" serial PRIMARY KEY NOT NULL, "tenant_id" integer NOT NULL, "provider_id" integer NOT NULL, "is_active" boolean DEFAULT true, "credit_multiplier" numeric DEFAULT 1.0, "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL);`)

  // Foreign keys (wrapped in DO blocks with column existence checks)
  // Tables may already exist from another migration with different column names (e.g. `tenant` vs `tenant_id`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_credits_tenant_id_tenants_id_fk') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_credits' AND column_name = 'tenant_id') THEN ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_tenant_id_tenants_id_fk') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'tenant_id') THEN ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_credit_package_id_credit_packages_id_fk') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'credit_package_id') THEN ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_package_id_credit_packages_id_fk" FOREIGN KEY ("credit_package_id") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_tenant_id_tenants_id_fk') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'tenant_id') THEN ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_tenant_id_tenants_id_fk') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'tenant_id') THEN ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_provider_id_ai_providers_id_fk') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'provider_id') THEN ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // Indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_packages_updated_at_idx" ON "credit_packages" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_packages_created_at_idx" ON "credit_packages" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_credits_tenant_idx" ON "tenant_credits" USING btree ("tenant_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_credits_updated_at_idx" ON "tenant_credits" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_credits_created_at_idx" ON "tenant_credits" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_transactions_tenant_idx" ON "credit_transactions" USING btree ("tenant_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_transactions_updated_at_idx" ON "credit_transactions" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_transactions_created_at_idx" ON "credit_transactions" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "usage_logs_tenant_idx" ON "usage_logs" USING btree ("tenant_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "usage_logs_updated_at_idx" ON "usage_logs" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "usage_logs_created_at_idx" ON "usage_logs" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_providers_updated_at_idx" ON "ai_providers" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_providers_created_at_idx" ON "ai_providers" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_tenant_idx" ON "tenant_provider_access" USING btree ("tenant_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_provider_idx" ON "tenant_provider_access" USING btree ("provider_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_updated_at_idx" ON "tenant_provider_access" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_created_at_idx" ON "tenant_provider_access" USING btree ("created_at");`)

  // Remove broken migration record so it never runs again
  await db.execute(sql`DELETE FROM "payload_migrations" WHERE name = '20260620_205416';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "tenant_credits" DROP CONSTRAINT IF EXISTS "tenant_credits_tenant_id_tenants_id_fk";`)
  await db.execute(sql`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_tenant_id_tenants_id_fk";`)
  await db.execute(sql`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_credit_package_id_credit_packages_id_fk";`)
  await db.execute(sql`ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_tenant_id_tenants_id_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_tenant_id_tenants_id_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_provider_id_ai_providers_id_fk";`)
  await db.execute(sql`DROP INDEX IF EXISTS "credit_packages_updated_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "credit_packages_created_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tenant_credits_tenant_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tenant_credits_updated_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tenant_credits_created_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "credit_transactions_tenant_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "credit_transactions_updated_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "credit_transactions_created_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "usage_logs_tenant_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "usage_logs_updated_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "usage_logs_created_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "ai_providers_updated_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "ai_providers_created_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tenant_provider_access_tenant_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tenant_provider_access_provider_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tenant_provider_access_updated_at_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tenant_provider_access_created_at_idx";`)
  await db.execute(sql`DROP TABLE IF EXISTS "credit_packages" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "tenant_credits" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "credit_transactions" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "usage_logs" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "ai_providers" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "tenant_provider_access" CASCADE;`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_credit_transactions_type";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_credit_transactions_source";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_usage_logs_channel";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_usage_logs_service";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_usage_logs_provider";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_ai_providers_provider";`)
}
