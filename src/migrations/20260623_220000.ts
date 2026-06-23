import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // First drop the faulty tables from the previous migration (if any)
  await db.execute(sql`DROP TABLE IF EXISTS "credit_packages" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "tenant_credits" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "credit_transactions" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "usage_logs" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "ai_providers" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "tenant_provider_access" CASCADE;`)

  // Drop old enum types (if any)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_credit_transactions_type";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_credit_transactions_source";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_usage_logs_channel";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_usage_logs_service";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_usage_logs_provider";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_ai_providers_provider";`)

  // ---- credit_packages ----
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "credit_packages" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "description" varchar,
      "credits" numeric NOT NULL,
      "price" numeric NOT NULL,
      "currency" varchar DEFAULT 'usd',
      "duration_months" numeric DEFAULT 6,
      "stripe_price_id" varchar,
      "stripe_product_id" varchar,
      "is_active" boolean DEFAULT true,
      "display_order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ---- tenant_credits ----
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tenant_credits" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant" integer NOT NULL,
      "balance" numeric DEFAULT 0 NOT NULL,
      "total_purchased" numeric DEFAULT 0,
      "total_used" numeric DEFAULT 0,
      "total_expired" numeric DEFAULT 0,
      "earliest_expiry" timestamp(3) with time zone,
      "last_top_up_at" timestamp(3) with time zone,
      "monthly_limit" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ---- credit_transactions ----
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "credit_transactions" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant" integer NOT NULL,
      "type" varchar NOT NULL,
      "amount" numeric NOT NULL,
      "balance_before" numeric DEFAULT 0,
      "balance_after" numeric DEFAULT 0,
      "source" varchar DEFAULT 'admin',
      "description" varchar,
      "stripe_payment_intent_id" varchar,
      "expires_at" timestamp(3) with time zone,
      "credit_package" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ---- usage_logs ----
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "usage_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant" integer NOT NULL,
      "conversation" varchar,
      "channel" varchar NOT NULL,
      "service" varchar NOT NULL,
      "provider" varchar NOT NULL,
      "model" varchar,
      "duration" numeric,
      "tokens" numeric,
      "characters" numeric,
      "audio_seconds" numeric,
      "credits_used" numeric NOT NULL,
      "input_preview" varchar,
      "metadata" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ---- ai_providers ----
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ai_providers" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "display_name" varchar,
      "provider_type" varchar NOT NULL,
      "api_key" varchar,
      "base_url" varchar,
      "models" jsonb NOT NULL,
      "default_model" varchar,
      "credit_multiplier" numeric DEFAULT 1.0,
      "is_active" boolean DEFAULT true,
      "is_system" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ---- tenant_provider_access ----
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tenant_provider_access" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant" integer NOT NULL,
      "provider" integer NOT NULL,
      "allowed_models" jsonb,
      "default_model" varchar,
      "credit_multiplier" numeric DEFAULT 1.0,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ---- Foreign keys ----
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_credits_tenant_tenants_fk') THEN
        ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_tenant_tenants_fk') THEN
        ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_credit_package_credit_packages_fk') THEN
        ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_package_credit_packages_fk" FOREIGN KEY ("credit_package") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_tenant_tenants_fk') THEN
        ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_providers_name_unique') THEN
        ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_name_unique" UNIQUE ("name");
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_tenant_tenants_fk') THEN
        ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_provider_ai_providers_fk') THEN
        ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_provider_ai_providers_fk" FOREIGN KEY ("provider") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)

  // ---- Indexes ----
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_packages_updated_at_idx" ON "credit_packages" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_packages_created_at_idx" ON "credit_packages" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_credits_tenant_idx" ON "tenant_credits" USING btree ("tenant");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_credits_updated_at_idx" ON "tenant_credits" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_credits_created_at_idx" ON "tenant_credits" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_transactions_tenant_idx" ON "credit_transactions" USING btree ("tenant");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_transactions_updated_at_idx" ON "credit_transactions" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_transactions_created_at_idx" ON "credit_transactions" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "usage_logs_tenant_idx" ON "usage_logs" USING btree ("tenant");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "usage_logs_updated_at_idx" ON "usage_logs" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "usage_logs_created_at_idx" ON "usage_logs" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_providers_updated_at_idx" ON "ai_providers" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "ai_providers_created_at_idx" ON "ai_providers" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_tenant_idx" ON "tenant_provider_access" USING btree ("tenant");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_provider_idx" ON "tenant_provider_access" USING btree ("provider");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_updated_at_idx" ON "tenant_provider_access" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "tenant_provider_access_created_at_idx" ON "tenant_provider_access" USING btree ("created_at");`)

  // Remove old failed migration records
  await db.execute(sql`DELETE FROM "payload_migrations" WHERE name = '20260620_205416';`)
  await db.execute(sql`DELETE FROM "payload_migrations" WHERE name = '20260623_200000';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "credit_packages" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "tenant_credits" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "credit_transactions" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "usage_logs" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "ai_providers" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "tenant_provider_access" CASCADE;`)
}
