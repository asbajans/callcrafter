import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { fileURLToPath } from 'url';

import { Users } from './src/payload/collections/Users'
import { Tenants } from './src/payload/collections/Tenants'
import { Agents } from './src/payload/collections/Agents'
import { VoiceConfigs } from './src/payload/collections/VoiceConfigs'
import { PhoneNumbers } from './src/payload/collections/PhoneNumbers'
import { ProviderConfigs } from './src/payload/collections/ProviderConfigs'
import { SipTrunks } from './src/payload/collections/SipTrunks'
import { Conversations } from './src/payload/collections/Conversations'
import { Messages } from './src/payload/collections/Messages'
import { TrainingDocs } from './src/payload/collections/TrainingDocs'
import { PricingPlans } from './src/payload/collections/PricingPlans'
import { Subscriptions } from './src/payload/collections/Subscriptions'
import { Payments } from './src/payload/collections/Payments'
import { WebhookLogs } from './src/payload/collections/WebhookLogs'
import { Media } from './src/payload/collections/Media'
import { WhatsAppAccounts } from './src/payload/collections/WhatsAppAccounts'
import { WhatsAppConversations } from './src/payload/collections/WhatsAppConversations'
import { WhatsAppMessages } from './src/payload/collections/WhatsAppMessages'

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'dev-secret',
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: process.env.NODE_ENV !== 'production',
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
    WhatsAppAccounts,
    WhatsAppConversations,
    WhatsAppMessages,
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
