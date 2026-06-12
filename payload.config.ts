import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  Users,
  Tenants,
  Agents,
  VoiceConfigs,
  PhoneNumbers,
  ProviderConfigs,
  SipTrunks,
  Conversations,
  Messages,
  TrainingDocs,
  PricingPlans,
  Subscriptions,
  Payments,
  WebhookLogs,
  Media,
} from '@/payload/collections/index'

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'dev-secret',
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: true,
  }),
  collections: [
    Users,
    Tenants,
    Agents,
    VoiceConfigs,
    PhoneNumbers,
    ProviderConfigs,
    SipTrunks,
    Conversations,
    Messages,
    TrainingDocs,
    PricingPlans,
    Subscriptions,
    Payments,
    WebhookLogs,
    Media,
  ],
  admin: {
    user: Users.slug,
    meta: {
      title: 'CallCrafter Admin',
    },
  },
  editor: lexicalEditor(),
  plugins: [],
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload/payload-types.ts'),
  },
  cors: [
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    ...(process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) || []),
  ],
  onInit: async (payload) => {
    payload.logger.info('CallCrafter CMS initialized');
  },
});
