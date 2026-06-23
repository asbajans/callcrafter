import type { CollectionConfig } from 'payload'

export const UsageLogs: CollectionConfig = {
  slug: 'usage-logs',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'description',
    group: 'Billing',
    defaultColumns: ['tenant', 'channel', 'service', 'provider', 'creditsUsed', 'createdAt'],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'conversation',
      type: 'text',
      admin: {
        description: 'Conversation ID or external reference',
      },
    },
    {
      name: 'channel',
      type: 'select',
      options: [
        { label: 'Voice', value: 'voice' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Instagram', value: 'instagram' },
        { label: 'Web Chat', value: 'web' },
      ],
      required: true,
    },
    {
      name: 'service',
      type: 'select',
      required: true,
      options: [
        { label: 'STT', value: 'stt' },
        { label: 'TTS', value: 'tts' },
        { label: 'LLM', value: 'llm' },
      ],
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'OpenAI', value: 'openai' },
        { label: 'Anthropic', value: 'anthropic' },
        { label: 'Gemini', value: 'gemini' },
        { label: 'OpenRouter', value: 'openrouter' },
        { label: 'Self-Hosted', value: 'self-hosted' },
        { label: 'Custom', value: 'custom' },
      ],
    },
    {
      name: 'model',
      type: 'text',
    },
    {
      name: 'duration',
      type: 'number',
      admin: {
        description: 'Duration in seconds (voice)',
      },
    },
    {
      name: 'tokens',
      type: 'number',
      admin: {
        description: 'LLM token count',
      },
    },
    {
      name: 'characters',
      type: 'number',
      admin: {
        description: 'TTS character count',
      },
    },
    {
      name: 'audioSeconds',
      type: 'number',
      admin: {
        description: 'STT audio seconds',
      },
    },
    {
      name: 'creditsUsed',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'inputPreview',
      type: 'text',
      maxLength: 200,
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  timestamps: true,
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) {
        return { tenant: { equals: user.tenant } }
      }
      return false
    },
    create: () => true,
    update: () => false,
    delete: () => false,
  },
}
