import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Each ALTER TABLE is guarded by a DO block that checks table/column existence.
  // PostgreSQL's RENAME COLUMN has no IF EXISTS, and DROP CONSTRAINT IF EXISTS
  // still requires the TABLE to exist — both fail if the table is missing.

  // -- tenant_credits: tenant -> tenant_id --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_credits') THEN
        ALTER TABLE "tenant_credits" DROP CONSTRAINT IF EXISTS "tenant_credits_tenant_tenants_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_credits' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_credits' AND column_name = 'tenant_id') THEN
          ALTER TABLE "tenant_credits" RENAME COLUMN "tenant" TO "tenant_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_credits' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_credits_tenant_id_tenants_fk') THEN
          ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_tenant_id_tenants_fk"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- credit_transactions: tenant -> tenant_id and credit_package -> credit_package_id --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
        ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_tenant_tenants_fk";
        ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_credit_package_credit_packages_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'tenant_id') THEN
          ALTER TABLE "credit_transactions" RENAME COLUMN "tenant" TO "tenant_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'credit_package')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'credit_package_id') THEN
          ALTER TABLE "credit_transactions" RENAME COLUMN "credit_package" TO "credit_package_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_tenant_id_tenants_fk') THEN
          ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_id_tenants_fk"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'credit_package_id')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_credit_package_id_credit_packages_fk') THEN
          ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_package_id_credit_packages_fk"
            FOREIGN KEY ("credit_package_id") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- usage_logs: tenant -> tenant_id --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_logs') THEN
        ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_tenant_tenants_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'tenant_id') THEN
          ALTER TABLE "usage_logs" RENAME COLUMN "tenant" TO "tenant_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_tenant_id_tenants_fk') THEN
          ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_id_tenants_fk"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- tenant_provider_access: tenant -> tenant_id and provider -> provider_id --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_provider_access') THEN
        ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_tenant_tenants_fk";
        ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_provider_ai_providers_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'tenant_id') THEN
          ALTER TABLE "tenant_provider_access" RENAME COLUMN "tenant" TO "tenant_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'provider')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'provider_id') THEN
          ALTER TABLE "tenant_provider_access" RENAME COLUMN "provider" TO "provider_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_tenant_id_tenants_fk') THEN
          ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_tenant_id_tenants_fk"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'provider_id')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_provider_id_ai_providers_fk') THEN
          ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_provider_id_ai_providers_fk"
            FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- agents.model: enum -> varchar (allows any model ID) --
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

  // -- agents.provider: add relationship column + FK --
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
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // -- tenant_credits: revert --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_credits') THEN
        ALTER TABLE "tenant_credits" DROP CONSTRAINT IF EXISTS "tenant_credits_tenant_id_tenants_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_credits' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_credits' AND column_name = 'tenant') THEN
          ALTER TABLE "tenant_credits" RENAME COLUMN "tenant_id" TO "tenant";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_credits' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_credits_tenant_tenants_fk') THEN
          ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_tenant_tenants_fk"
            FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- credit_transactions: revert --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
        ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_tenant_id_tenants_fk";
        ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_credit_package_id_credit_packages_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'tenant') THEN
          ALTER TABLE "credit_transactions" RENAME COLUMN "tenant_id" TO "tenant";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'credit_package_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'credit_package') THEN
          ALTER TABLE "credit_transactions" RENAME COLUMN "credit_package_id" TO "credit_package";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_tenant_tenants_fk') THEN
          ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_tenants_fk"
            FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'credit_package')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_credit_package_credit_packages_fk') THEN
          ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_package_credit_packages_fk"
            FOREIGN KEY ("credit_package") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- usage_logs: revert --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_logs') THEN
        ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_tenant_id_tenants_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'tenant') THEN
          ALTER TABLE "usage_logs" RENAME COLUMN "tenant_id" TO "tenant";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_logs' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_tenant_tenants_fk') THEN
          ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_tenants_fk"
            FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- tenant_provider_access: revert --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_provider_access') THEN
        ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_tenant_id_tenants_fk";
        ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_provider_id_ai_providers_fk";
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'tenant_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'tenant') THEN
          ALTER TABLE "tenant_provider_access" RENAME COLUMN "tenant_id" TO "tenant";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'provider_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'provider') THEN
          ALTER TABLE "tenant_provider_access" RENAME COLUMN "provider_id" TO "provider";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'tenant')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_tenant_tenants_fk') THEN
          ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_tenant_tenants_fk"
            FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_provider_access' AND column_name = 'provider')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_provider_ai_providers_fk') THEN
          ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_provider_ai_providers_fk"
            FOREIGN KEY ("provider") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // -- agents.model: revert to enum --
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'model'
                     AND data_type IN ('character varying', 'text')) THEN
        ALTER TABLE "agents" ALTER COLUMN "model" TYPE "enum_agents_model" USING "model"::text::"enum_agents_model";
        ALTER TABLE "agents" ALTER COLUMN "model" SET DEFAULT 'gpt-4o'::"enum_agents_model";
      END IF;
    END $$;
  `)

  // -- agents.provider: drop relationship --
  await db.execute(sql`ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_provider_id_ai_providers_fk";`)
  await db.execute(sql`ALTER TABLE "agents" DROP COLUMN IF EXISTS "provider_id";`)
}
