import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'tenant-admin', 'admin', 'super-admin');
  CREATE TYPE "public"."enum_users_status" AS ENUM('active', 'inactive', 'suspended');
  CREATE TYPE "public"."enum_tenants_industry" AS ENUM('healthcare', 'finance', 'retail', 'real_estate', 'education', 'technology', 'hospitality', 'logistics', 'insurance', 'telecommunications', 'other');
  CREATE TYPE "public"."enum_tenants_status" AS ENUM('active', 'trial', 'suspended', 'inactive');
  CREATE TYPE "public"."enum_tenants_default_provider" AS ENUM('twilio', 'zadarma', 'asterisk');
  CREATE TYPE "public"."enum_agents_channels" AS ENUM('voice', 'whatsapp', 'instagram', 'web');
  CREATE TYPE "public"."enum_agents_language" AS ENUM('tr', 'en', 'es', 'fr', 'de');
  CREATE TYPE "public"."enum_agents_model" AS ENUM('gpt-4', 'gpt-4o', 'gpt-4o-mini', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku');
  CREATE TYPE "public"."enum_agents_status" AS ENUM('active', 'inactive', 'testing');
  CREATE TYPE "public"."enum_voice_configs_provider" AS ENUM('elevenlabs', 'google', 'azure');
  CREATE TYPE "public"."enum_voice_configs_language" AS ENUM('tr', 'en', 'es', 'fr', 'de');
  CREATE TYPE "public"."enum_voice_configs_gender" AS ENUM('male', 'female');
  CREATE TYPE "public"."enum_voice_configs_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_phone_numbers_type" AS ENUM('mobile', 'landline', 'tollfree');
  CREATE TYPE "public"."enum_phone_numbers_provider" AS ENUM('twilio', 'zadarma', 'asterisk', 'own_sip');
  CREATE TYPE "public"."enum_phone_numbers_status" AS ENUM('active', 'porting', 'suspended');
  CREATE TYPE "public"."enum_provider_configs_provider" AS ENUM('twilio', 'zadarma', 'asterisk');
  CREATE TYPE "public"."enum_provider_configs_type" AS ENUM('ours', 'own');
  CREATE TYPE "public"."enum_sip_trunks_provider" AS ENUM('twilio', 'zadarma', 'asterisk', 'generic');
  CREATE TYPE "public"."enum_sip_trunks_type" AS ENUM('ours', 'own');
  CREATE TYPE "public"."enum_sip_trunks_dtmf_mode" AS ENUM('rfc2833', 'sipinfo', 'inband');
  CREATE TYPE "public"."enum_sip_trunks_status" AS ENUM('active', 'error', 'testing');
  CREATE TYPE "public"."enum_conversations_channel" AS ENUM('voice', 'whatsapp', 'instagram', 'web');
  CREATE TYPE "public"."enum_conversations_status" AS ENUM('active', 'completed', 'missed', 'failed');
  CREATE TYPE "public"."enum_conversations_sentiment" AS ENUM('positive', 'neutral', 'negative');
  CREATE TYPE "public"."enum_messages_role" AS ENUM('user', 'assistant', 'system', 'tool');
  CREATE TYPE "public"."enum_messages_content_type" AS ENUM('text', 'voice', 'image', 'file');
  CREATE TYPE "public"."enum_training_docs_type" AS ENUM('pdf', 'docx', 'txt', 'csv', 'json', 'html');
  CREATE TYPE "public"."enum_training_docs_status" AS ENUM('pending', 'processing', 'ready', 'error');
  CREATE TYPE "public"."enum_pricing_plans_billing_cycle" AS ENUM('monthly', 'yearly', 'one_time');
  CREATE TYPE "public"."enum_pricing_plans_status" AS ENUM('active', 'inactive', 'deprecated');
  CREATE TYPE "public"."enum_subscriptions_status" AS ENUM('active', 'paused', 'cancelled', 'past_due', 'trialing');
  CREATE TYPE "public"."enum_payments_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');
  CREATE TYPE "public"."enum_webhook_logs_source" AS ENUM('stripe', 'elevenlabs', 'twilio', 'zadarma', 'whatsapp', 'instagram');
  CREATE TYPE "public"."enum_webhook_logs_status" AS ENUM('pending', 'success', 'failed', 'retrying');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar,
  	"last_name" varchar,
  	"role" "enum_users_role" DEFAULT 'user',
  	"tenant_id" integer,
  	"status" "enum_users_status" DEFAULT 'active',
  	"phone" varchar,
  	"avatar_id" integer,
  	"api_key" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"website" varchar,
  	"logo_id" integer,
  	"description" varchar,
  	"industry" "enum_tenants_industry",
  	"status" "enum_tenants_status" DEFAULT 'trial',
  	"trial_end_date" timestamp(3) with time zone,
  	"subscription_id" integer,
  	"default_provider" "enum_tenants_default_provider" DEFAULT 'twilio',
  	"settings" jsonb,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "agents_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_agents_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "agents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"system_prompt" varchar NOT NULL,
  	"voice_id" integer NOT NULL,
  	"language" "enum_agents_language" DEFAULT 'tr',
  	"model" "enum_agents_model" DEFAULT 'gpt-4o',
  	"temperature" numeric DEFAULT 0.7,
  	"max_tokens" numeric DEFAULT 2048,
  	"max_call_duration" numeric DEFAULT 3600,
  	"greeting_message" varchar,
  	"tools" jsonb,
  	"status" "enum_agents_status" DEFAULT 'inactive',
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "agents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"training_docs_id" integer
  );
  
  CREATE TABLE "voice_configs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"provider" "enum_voice_configs_provider" DEFAULT 'elevenlabs',
  	"provider_voice_id" varchar NOT NULL,
  	"language" "enum_voice_configs_language" DEFAULT 'tr',
  	"gender" "enum_voice_configs_gender",
  	"accent" varchar,
  	"is_cloned" boolean DEFAULT false,
  	"sample_url" varchar,
  	"preview_url" varchar,
  	"settings" jsonb,
  	"is_public" boolean DEFAULT false,
  	"status" "enum_voice_configs_status" DEFAULT 'active',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "phone_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"number" varchar NOT NULL,
  	"friendly_name" varchar,
  	"type" "enum_phone_numbers_type" DEFAULT 'mobile',
  	"provider" "enum_phone_numbers_provider" DEFAULT 'twilio',
  	"provider_config_id" integer,
  	"sip_trunk_id" integer,
  	"is_own_number" boolean,
  	"forward_to_id" integer,
  	"twilio_sid" varchar,
  	"capabilities" jsonb,
  	"status" "enum_phone_numbers_status" DEFAULT 'active',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "provider_configs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"provider" "enum_provider_configs_provider" NOT NULL,
  	"type" "enum_provider_configs_type" DEFAULT 'ours',
  	"config" jsonb NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"last_health_check" timestamp(3) with time zone,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sip_trunks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"provider" "enum_sip_trunks_provider" NOT NULL,
  	"type" "enum_sip_trunks_type" DEFAULT 'ours',
  	"credentials" jsonb,
  	"codecs" jsonb,
  	"dtmf_mode" "enum_sip_trunks_dtmf_mode" DEFAULT 'rfc2833',
  	"status" "enum_sip_trunks_status" DEFAULT 'active',
  	"last_health_check" timestamp(3) with time zone,
  	"error_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "conversations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"agent_id" integer,
  	"channel" "enum_conversations_channel" NOT NULL,
  	"external_id" varchar,
  	"contact" jsonb,
  	"status" "enum_conversations_status" DEFAULT 'active',
  	"start_time" timestamp(3) with time zone NOT NULL,
  	"end_time" timestamp(3) with time zone,
  	"duration" numeric,
  	"summary" varchar,
  	"sentiment" "enum_conversations_sentiment",
  	"tags" jsonb,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"role" "enum_messages_role" NOT NULL,
  	"content" varchar NOT NULL,
  	"content_type" "enum_messages_content_type" DEFAULT 'text',
  	"audio_url" varchar,
  	"file_url" varchar,
  	"tokens" numeric,
  	"tool_calls" jsonb,
  	"metadata" jsonb,
  	"timestamp" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "training_docs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"agent_id" integer,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"type" "enum_training_docs_type" NOT NULL,
  	"file_id" integer NOT NULL,
  	"status" "enum_training_docs_status" DEFAULT 'pending',
  	"chunk_count" numeric,
  	"embedding_model" varchar,
  	"vector_count" numeric,
  	"error_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pricing_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"value" varchar,
  	"included" boolean
  );
  
  CREATE TABLE "pricing_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"price" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd',
  	"stripe_price_id" varchar,
  	"stripe_product_id" varchar,
  	"billing_cycle" "enum_pricing_plans_billing_cycle" DEFAULT 'monthly',
  	"limits" jsonb,
  	"status" "enum_pricing_plans_status" DEFAULT 'active',
  	"display_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"stripe_subscription_id" varchar,
  	"stripe_customer_id" varchar,
  	"status" "enum_subscriptions_status" DEFAULT 'trialing',
  	"current_period_start" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"trial_end" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"usage" jsonb,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subscription_id" integer,
  	"stripe_payment_intent_id" varchar,
  	"stripe_invoice_id" varchar,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd',
  	"status" "enum_payments_status" DEFAULT 'pending',
  	"description" varchar,
  	"metadata" jsonb,
  	"paid_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "webhook_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_type" varchar NOT NULL,
  	"source" "enum_webhook_logs_source" NOT NULL,
  	"status" "enum_webhook_logs_status" DEFAULT 'pending',
  	"payload" jsonb NOT NULL,
  	"response" jsonb,
  	"error" varchar,
  	"retries" numeric DEFAULT 0,
  	"processed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"tenants_id" integer,
  	"agents_id" integer,
  	"voice_configs_id" integer,
  	"phone_numbers_id" integer,
  	"provider_configs_id" integer,
  	"sip_trunks_id" integer,
  	"conversations_id" integer,
  	"messages_id" integer,
  	"training_docs_id" integer,
  	"pricing_plans_id" integer,
  	"subscriptions_id" integer,
  	"payments_id" integer,
  	"webhook_logs_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agents_channels" ADD CONSTRAINT "agents_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agents" ADD CONSTRAINT "agents_voice_id_voice_configs_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voice_configs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agents_rels" ADD CONSTRAINT "agents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "agents_rels" ADD CONSTRAINT "agents_rels_training_docs_fk" FOREIGN KEY ("training_docs_id") REFERENCES "public"."training_docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "voice_configs" ADD CONSTRAINT "voice_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_provider_config_id_provider_configs_id_fk" FOREIGN KEY ("provider_config_id") REFERENCES "public"."provider_configs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_sip_trunk_id_sip_trunks_id_fk" FOREIGN KEY ("sip_trunk_id") REFERENCES "public"."sip_trunks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_forward_to_id_agents_id_fk" FOREIGN KEY ("forward_to_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sip_trunks" ADD CONSTRAINT "sip_trunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_docs" ADD CONSTRAINT "training_docs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_docs" ADD CONSTRAINT "training_docs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_docs" ADD CONSTRAINT "training_docs_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pricing_plans_features" ADD CONSTRAINT "pricing_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_pricing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agents_fk" FOREIGN KEY ("agents_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_voice_configs_fk" FOREIGN KEY ("voice_configs_id") REFERENCES "public"."voice_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_phone_numbers_fk" FOREIGN KEY ("phone_numbers_id") REFERENCES "public"."phone_numbers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_provider_configs_fk" FOREIGN KEY ("provider_configs_id") REFERENCES "public"."provider_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sip_trunks_fk" FOREIGN KEY ("sip_trunks_id") REFERENCES "public"."sip_trunks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_conversations_fk" FOREIGN KEY ("conversations_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_training_docs_fk" FOREIGN KEY ("training_docs_id") REFERENCES "public"."training_docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pricing_plans_fk" FOREIGN KEY ("pricing_plans_id") REFERENCES "public"."pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_logs_fk" FOREIGN KEY ("webhook_logs_id") REFERENCES "public"."webhook_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "tenants_name_idx" ON "tenants" USING btree ("name");
  CREATE INDEX "tenants_logo_idx" ON "tenants" USING btree ("logo_id");
  CREATE INDEX "tenants_subscription_idx" ON "tenants" USING btree ("subscription_id");
  CREATE INDEX "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX "agents_channels_order_idx" ON "agents_channels" USING btree ("order");
  CREATE INDEX "agents_channels_parent_idx" ON "agents_channels" USING btree ("parent_id");
  CREATE INDEX "agents_tenant_idx" ON "agents" USING btree ("tenant_id");
  CREATE INDEX "agents_voice_idx" ON "agents" USING btree ("voice_id");
  CREATE INDEX "agents_updated_at_idx" ON "agents" USING btree ("updated_at");
  CREATE INDEX "agents_created_at_idx" ON "agents" USING btree ("created_at");
  CREATE INDEX "agents_rels_order_idx" ON "agents_rels" USING btree ("order");
  CREATE INDEX "agents_rels_parent_idx" ON "agents_rels" USING btree ("parent_id");
  CREATE INDEX "agents_rels_path_idx" ON "agents_rels" USING btree ("path");
  CREATE INDEX "agents_rels_training_docs_id_idx" ON "agents_rels" USING btree ("training_docs_id");
  CREATE INDEX "voice_configs_tenant_idx" ON "voice_configs" USING btree ("tenant_id");
  CREATE INDEX "voice_configs_updated_at_idx" ON "voice_configs" USING btree ("updated_at");
  CREATE INDEX "voice_configs_created_at_idx" ON "voice_configs" USING btree ("created_at");
  CREATE INDEX "phone_numbers_tenant_idx" ON "phone_numbers" USING btree ("tenant_id");
  CREATE INDEX "phone_numbers_provider_config_idx" ON "phone_numbers" USING btree ("provider_config_id");
  CREATE INDEX "phone_numbers_sip_trunk_idx" ON "phone_numbers" USING btree ("sip_trunk_id");
  CREATE INDEX "phone_numbers_forward_to_idx" ON "phone_numbers" USING btree ("forward_to_id");
  CREATE INDEX "phone_numbers_updated_at_idx" ON "phone_numbers" USING btree ("updated_at");
  CREATE INDEX "phone_numbers_created_at_idx" ON "phone_numbers" USING btree ("created_at");
  CREATE INDEX "provider_configs_tenant_idx" ON "provider_configs" USING btree ("tenant_id");
  CREATE INDEX "provider_configs_updated_at_idx" ON "provider_configs" USING btree ("updated_at");
  CREATE INDEX "provider_configs_created_at_idx" ON "provider_configs" USING btree ("created_at");
  CREATE INDEX "sip_trunks_tenant_idx" ON "sip_trunks" USING btree ("tenant_id");
  CREATE INDEX "sip_trunks_updated_at_idx" ON "sip_trunks" USING btree ("updated_at");
  CREATE INDEX "sip_trunks_created_at_idx" ON "sip_trunks" USING btree ("created_at");
  CREATE INDEX "conversations_tenant_idx" ON "conversations" USING btree ("tenant_id");
  CREATE INDEX "conversations_agent_idx" ON "conversations" USING btree ("agent_id");
  CREATE INDEX "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at");
  CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");
  CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  CREATE INDEX "training_docs_tenant_idx" ON "training_docs" USING btree ("tenant_id");
  CREATE INDEX "training_docs_agent_idx" ON "training_docs" USING btree ("agent_id");
  CREATE INDEX "training_docs_file_idx" ON "training_docs" USING btree ("file_id");
  CREATE INDEX "training_docs_updated_at_idx" ON "training_docs" USING btree ("updated_at");
  CREATE INDEX "training_docs_created_at_idx" ON "training_docs" USING btree ("created_at");
  CREATE INDEX "pricing_plans_features_order_idx" ON "pricing_plans_features" USING btree ("_order");
  CREATE INDEX "pricing_plans_features_parent_id_idx" ON "pricing_plans_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pricing_plans_name_idx" ON "pricing_plans" USING btree ("name");
  CREATE INDEX "pricing_plans_updated_at_idx" ON "pricing_plans" USING btree ("updated_at");
  CREATE INDEX "pricing_plans_created_at_idx" ON "pricing_plans" USING btree ("created_at");
  CREATE INDEX "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenant_id");
  CREATE INDEX "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");
  CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");
  CREATE INDEX "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX "payments_tenant_idx" ON "payments" USING btree ("tenant_id");
  CREATE INDEX "payments_subscription_idx" ON "payments" USING btree ("subscription_id");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE INDEX "webhook_logs_updated_at_idx" ON "webhook_logs" USING btree ("updated_at");
  CREATE INDEX "webhook_logs_created_at_idx" ON "webhook_logs" USING btree ("created_at");
  CREATE INDEX "media_tenant_idx" ON "media" USING btree ("tenant_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_agents_id_idx" ON "payload_locked_documents_rels" USING btree ("agents_id");
  CREATE INDEX "payload_locked_documents_rels_voice_configs_id_idx" ON "payload_locked_documents_rels" USING btree ("voice_configs_id");
  CREATE INDEX "payload_locked_documents_rels_phone_numbers_id_idx" ON "payload_locked_documents_rels" USING btree ("phone_numbers_id");
  CREATE INDEX "payload_locked_documents_rels_provider_configs_id_idx" ON "payload_locked_documents_rels" USING btree ("provider_configs_id");
  CREATE INDEX "payload_locked_documents_rels_sip_trunks_id_idx" ON "payload_locked_documents_rels" USING btree ("sip_trunks_id");
  CREATE INDEX "payload_locked_documents_rels_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("conversations_id");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");
  CREATE INDEX "payload_locked_documents_rels_training_docs_id_idx" ON "payload_locked_documents_rels" USING btree ("training_docs_id");
  CREATE INDEX "payload_locked_documents_rels_pricing_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("pricing_plans_id");
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");
  CREATE INDEX "payload_locked_documents_rels_webhook_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("webhook_logs_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "agents_channels" CASCADE;
  DROP TABLE "agents" CASCADE;
  DROP TABLE "agents_rels" CASCADE;
  DROP TABLE "voice_configs" CASCADE;
  DROP TABLE "phone_numbers" CASCADE;
  DROP TABLE "provider_configs" CASCADE;
  DROP TABLE "sip_trunks" CASCADE;
  DROP TABLE "conversations" CASCADE;
  DROP TABLE "messages" CASCADE;
  DROP TABLE "training_docs" CASCADE;
  DROP TABLE "pricing_plans_features" CASCADE;
  DROP TABLE "pricing_plans" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "payments" CASCADE;
  DROP TABLE "webhook_logs" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_status";
  DROP TYPE "public"."enum_tenants_industry";
  DROP TYPE "public"."enum_tenants_status";
  DROP TYPE "public"."enum_tenants_default_provider";
  DROP TYPE "public"."enum_agents_channels";
  DROP TYPE "public"."enum_agents_language";
  DROP TYPE "public"."enum_agents_model";
  DROP TYPE "public"."enum_agents_status";
  DROP TYPE "public"."enum_voice_configs_provider";
  DROP TYPE "public"."enum_voice_configs_language";
  DROP TYPE "public"."enum_voice_configs_gender";
  DROP TYPE "public"."enum_voice_configs_status";
  DROP TYPE "public"."enum_phone_numbers_type";
  DROP TYPE "public"."enum_phone_numbers_provider";
  DROP TYPE "public"."enum_phone_numbers_status";
  DROP TYPE "public"."enum_provider_configs_provider";
  DROP TYPE "public"."enum_provider_configs_type";
  DROP TYPE "public"."enum_sip_trunks_provider";
  DROP TYPE "public"."enum_sip_trunks_type";
  DROP TYPE "public"."enum_sip_trunks_dtmf_mode";
  DROP TYPE "public"."enum_sip_trunks_status";
  DROP TYPE "public"."enum_conversations_channel";
  DROP TYPE "public"."enum_conversations_status";
  DROP TYPE "public"."enum_conversations_sentiment";
  DROP TYPE "public"."enum_messages_role";
  DROP TYPE "public"."enum_messages_content_type";
  DROP TYPE "public"."enum_training_docs_type";
  DROP TYPE "public"."enum_training_docs_status";
  DROP TYPE "public"."enum_pricing_plans_billing_cycle";
  DROP TYPE "public"."enum_pricing_plans_status";
  DROP TYPE "public"."enum_subscriptions_status";
  DROP TYPE "public"."enum_payments_status";
  DROP TYPE "public"."enum_webhook_logs_source";
  DROP TYPE "public"."enum_webhook_logs_status";`)
}
