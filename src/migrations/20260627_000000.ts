import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Rename relationship columns to match Payload's _id suffix convention.
  // The 20260623_220000 migration created columns without `_id` (e.g. `tenant` instead of `tenant_id`),
  // but Payload always appends `_id` for relationship field column names.

  // -- tenant_credits: tenant -> tenant_id --
  await db.execute(sql`ALTER TABLE "tenant_credits" DROP CONSTRAINT IF EXISTS "tenant_credits_tenant_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_credits" RENAME COLUMN "tenant" TO "tenant_id";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_credits_tenant_id_tenants_fk') THEN ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_tenant_id_tenants_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // -- credit_transactions: tenant -> tenant_id --
  await db.execute(sql`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_tenant_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "credit_transactions" RENAME COLUMN "tenant" TO "tenant_id";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_tenant_id_tenants_fk') THEN ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_id_tenants_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // -- credit_transactions: credit_package -> credit_package_id --
  await db.execute(sql`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_credit_package_credit_packages_fk";`)
  await db.execute(sql`ALTER TABLE "credit_transactions" RENAME COLUMN "credit_package" TO "credit_package_id";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_credit_package_id_credit_packages_fk') THEN ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_package_id_credit_packages_fk" FOREIGN KEY ("credit_package_id") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // -- usage_logs: tenant -> tenant_id --
  await db.execute(sql`ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_tenant_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "usage_logs" RENAME COLUMN "tenant" TO "tenant_id";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_tenant_id_tenants_fk') THEN ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_id_tenants_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // -- tenant_provider_access: tenant -> tenant_id --
  await db.execute(sql`ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_tenant_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_provider_access" RENAME COLUMN "tenant" TO "tenant_id";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_tenant_id_tenants_fk') THEN ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_tenant_id_tenants_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // -- tenant_provider_access: provider -> provider_id --
  await db.execute(sql`ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_provider_ai_providers_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_provider_access" RENAME COLUMN "provider" TO "provider_id";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_provider_id_ai_providers_fk') THEN ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_provider_id_ai_providers_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // -- agents.model: enum -> varchar (allows any model ID, e.g. OpenRouter models) --
  await db.execute(sql`ALTER TABLE "agents" ALTER COLUMN "model" TYPE varchar;`)
  await db.execute(sql`ALTER TABLE "agents" ALTER COLUMN "model" SET DEFAULT 'gpt-4o';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "tenant_credits" DROP CONSTRAINT IF EXISTS "tenant_credits_tenant_id_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_credits" RENAME COLUMN "tenant_id" TO "tenant";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_credits_tenant_tenants_fk') THEN ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  await db.execute(sql`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_tenant_id_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "credit_transactions" RENAME COLUMN "tenant_id" TO "tenant";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_tenant_tenants_fk') THEN ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  await db.execute(sql`ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_credit_package_id_credit_packages_fk";`)
  await db.execute(sql`ALTER TABLE "credit_transactions" RENAME COLUMN "credit_package_id" TO "credit_package";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_credit_package_credit_packages_fk') THEN ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_package_credit_packages_fk" FOREIGN KEY ("credit_package") REFERENCES "public"."credit_packages"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  await db.execute(sql`ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "usage_logs_tenant_id_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "usage_logs" RENAME COLUMN "tenant_id" TO "tenant";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_tenant_tenants_fk') THEN ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  await db.execute(sql`ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_tenant_id_tenants_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_provider_access" RENAME COLUMN "tenant_id" TO "tenant";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_tenant_tenants_fk') THEN ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_tenant_tenants_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  await db.execute(sql`ALTER TABLE "tenant_provider_access" DROP CONSTRAINT IF EXISTS "tenant_provider_access_provider_id_ai_providers_fk";`)
  await db.execute(sql`ALTER TABLE "tenant_provider_access" RENAME COLUMN "provider_id" TO "provider";`)
  await db.execute(sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_provider_access_provider_ai_providers_fk') THEN ALTER TABLE "tenant_provider_access" ADD CONSTRAINT "tenant_provider_access_provider_ai_providers_fk" FOREIGN KEY ("provider") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;`)

  // -- agents.model: revert to enum --
  await db.execute(sql`ALTER TABLE "agents" ALTER COLUMN "model" TYPE "enum_agents_model" USING "model"::text::"enum_agents_model";`)
  await db.execute(sql`ALTER TABLE "agents" ALTER COLUMN "model" SET DEFAULT 'gpt-4o'::"enum_agents_model";`)
}
