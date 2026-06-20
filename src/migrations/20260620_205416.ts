import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_whatsapp_accounts_connection_type') THEN CREATE TYPE "public"."enum_whatsapp_accounts_connection_type" AS ENUM('cloud_api', 'qr'); END IF; END $$;
  DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_whatsapp_accounts_qr_status') THEN CREATE TYPE "public"."enum_whatsapp_accounts_qr_status" AS ENUM('idle', 'connecting', 'connected', 'disconnected'); END IF; END $$;
  DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_whatsapp_conversations_status') THEN CREATE TYPE "public"."enum_whatsapp_conversations_status" AS ENUM('open', 'pending', 'resolved', 'closed'); END IF; END $$;
  DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_whatsapp_messages_direction') THEN CREATE TYPE "public"."enum_whatsapp_messages_direction" AS ENUM('inbound', 'outbound'); END IF; END $$;
  DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_whatsapp_messages_message_type') THEN CREATE TYPE "public"."enum_whatsapp_messages_message_type" AS ENUM('text', 'image', 'video', 'audio', 'document', 'location', 'sticker', 'template', 'interactive', 'reaction'); END IF; END $$;
  DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_whatsapp_messages_status') THEN CREATE TYPE "public"."enum_whatsapp_messages_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed'); END IF; END $$;
  CREATE TABLE "whatsapp_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"phone_number_id" varchar,
  	"business_account_id" varchar,
  	"access_token" varchar,
  	"webhook_verify_token" varchar,
  	"display_phone_number" varchar,
  	"connection_type" "enum_whatsapp_accounts_connection_type" DEFAULT 'cloud_api',
  	"qr_session_id" varchar,
  	"qr_code_data" varchar,
  	"qr_status" "enum_whatsapp_accounts_qr_status" DEFAULT 'idle',
  	"is_active" boolean DEFAULT true,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "whatsapp_conversations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"agent_id" integer,
  	"contact_phone" varchar NOT NULL,
  	"contact_name" varchar,
  	"contact_jid" varchar,
  	"profile_picture_url" varchar,
  	"assigned_to_id" integer,
  	"status" "enum_whatsapp_conversations_status" DEFAULT 'open',
  	"unread_count" numeric DEFAULT 0,
  	"last_message_at" timestamp(3) with time zone,
  	"last_message_preview" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "whatsapp_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"whats_app_message_id" varchar,
  	"direction" "enum_whatsapp_messages_direction" NOT NULL,
  	"message_type" "enum_whatsapp_messages_message_type" NOT NULL,
  	"body" varchar,
  	"media_url" varchar,
  	"media_mime_type" varchar,
  	"media_caption" varchar,
  	"template_name" varchar,
  	"status" "enum_whatsapp_messages_status" DEFAULT 'sent',
  	"delivered_at" timestamp(3) with time zone,
  	"read_at" timestamp(3) with time zone,
  	"sent_by_id" integer,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "sip_trunks" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "training_docs" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "messages" ADD COLUMN "tenant_id" integer NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "whatsapp_accounts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "whatsapp_conversations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "whatsapp_messages_id" integer;
  ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "whatsapp_accounts_tenant_idx" ON "whatsapp_accounts" USING btree ("tenant_id");
  CREATE INDEX "whatsapp_accounts_updated_at_idx" ON "whatsapp_accounts" USING btree ("updated_at");
  CREATE INDEX "whatsapp_accounts_created_at_idx" ON "whatsapp_accounts" USING btree ("created_at");
  CREATE INDEX "whatsapp_conversations_account_idx" ON "whatsapp_conversations" USING btree ("account_id");
  CREATE INDEX "whatsapp_conversations_tenant_idx" ON "whatsapp_conversations" USING btree ("tenant_id");
  CREATE INDEX "whatsapp_conversations_agent_idx" ON "whatsapp_conversations" USING btree ("agent_id");
  CREATE INDEX "whatsapp_conversations_assigned_to_idx" ON "whatsapp_conversations" USING btree ("assigned_to_id");
  CREATE INDEX "whatsapp_conversations_updated_at_idx" ON "whatsapp_conversations" USING btree ("updated_at");
  CREATE INDEX "whatsapp_conversations_created_at_idx" ON "whatsapp_conversations" USING btree ("created_at");
  CREATE INDEX "whatsapp_messages_conversation_idx" ON "whatsapp_messages" USING btree ("conversation_id");
  CREATE INDEX "whatsapp_messages_sent_by_idx" ON "whatsapp_messages" USING btree ("sent_by_id");
  CREATE INDEX "whatsapp_messages_updated_at_idx" ON "whatsapp_messages" USING btree ("updated_at");
  CREATE INDEX "whatsapp_messages_created_at_idx" ON "whatsapp_messages" USING btree ("created_at");
  ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whatsapp_accounts_fk" FOREIGN KEY ("whatsapp_accounts_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whatsapp_conversations_fk" FOREIGN KEY ("whatsapp_conversations_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whatsapp_messages_fk" FOREIGN KEY ("whatsapp_messages_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "messages_tenant_idx" ON "messages" USING btree ("tenant_id");
  CREATE INDEX "payload_locked_documents_rels_whatsapp_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("whatsapp_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_whatsapp_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("whatsapp_conversations_id");
  CREATE INDEX "payload_locked_documents_rels_whatsapp_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("whatsapp_messages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "whatsapp_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "whatsapp_conversations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "whatsapp_messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "whatsapp_accounts" CASCADE;
  DROP TABLE "whatsapp_conversations" CASCADE;
  DROP TABLE "whatsapp_messages" CASCADE;
  ALTER TABLE "messages" DROP CONSTRAINT "messages_tenant_id_tenants_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_whatsapp_accounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_whatsapp_conversations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_whatsapp_messages_fk";
  
  DROP INDEX "messages_tenant_idx";
  DROP INDEX "payload_locked_documents_rels_whatsapp_accounts_id_idx";
  DROP INDEX "payload_locked_documents_rels_whatsapp_conversations_id_idx";
  DROP INDEX "payload_locked_documents_rels_whatsapp_messages_id_idx";
  ALTER TABLE "sip_trunks" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "training_docs" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "messages" DROP COLUMN "tenant_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "whatsapp_accounts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "whatsapp_conversations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "whatsapp_messages_id";
  DROP TYPE "public"."enum_whatsapp_accounts_connection_type";
  DROP TYPE "public"."enum_whatsapp_accounts_qr_status";
  DROP TYPE "public"."enum_whatsapp_conversations_status";
  DROP TYPE "public"."enum_whatsapp_messages_direction";
  DROP TYPE "public"."enum_whatsapp_messages_message_type";
  DROP TYPE "public"."enum_whatsapp_messages_status";`)
}
