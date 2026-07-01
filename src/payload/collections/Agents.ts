import type { CollectionConfig } from 'payload'

export const Agents: CollectionConfig = {
  slug: 'agents',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'systemPrompt',
      type: 'textarea',
      required: true,
    },
    {
      name: 'voice',
      type: 'text',
      required: true,
      label: 'Voice ID',
    },
    {
      name: 'voiceName',
      type: 'text',
      label: 'Voice Display Name',
    },
    {
      name: 'ttsProvider',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { label: 'Otomatik (önce Edge TTS, sonra Piper)', value: 'auto' },
        { label: 'Edge TTS (Microsoft, ücretsiz)', value: 'edge-tts' },
        { label: 'Piper (yerel, offline)', value: 'piper' },
        { label: 'ElevenLabs (ücretli)', value: 'elevenlabs' },
      ],
      admin: {
        description: 'Hangi TTS motorunun kullanılacağı',
      },
    },
    {
      name: 'language',
      type: 'select',
      options: [
        { label: 'Türkçe', value: 'tr' },
        { label: 'English', value: 'en' },
        { label: 'Español', value: 'es' },
        { label: 'Français', value: 'fr' },
        { label: 'Deutsch', value: 'de' },
      ],
      defaultValue: 'tr',
    },
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'ai-providers' as any,
      admin: {
        description: 'AI Provider (OpenAI, Anthropic, OpenRouter etc.)',
      },
    },
    {
      name: 'model',
      type: 'text',
      defaultValue: 'gpt-4o',
      admin: {
        description: 'Model ID (örn: gpt-4o, claude-3-sonnet, openai/gpt-4o, mistralai/mistral-7b-instruct)',
      },
    },
    {
      name: 'temperature',
      type: 'number',
      min: 0,
      max: 2,
      defaultValue: 0.7,
    },
    {
      name: 'maxTokens',
      type: 'number',
      defaultValue: 2048,
    },
    {
      name: 'maxCallDuration',
      type: 'number',
      defaultValue: 3600,
    },
    {
      name: 'greetingMessage',
      type: 'text',
    },
    {
      name: 'tools',
      type: 'json',
    },
    {
      name: 'trainingDocs',
      type: 'relationship',
      relationTo: 'training-docs',
      hasMany: true,
    },
    {
      name: 'channels',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Voice', value: 'voice' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Instagram', value: 'instagram' },
        { label: 'Web', value: 'web' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Testing', value: 'testing' },
      ],
      defaultValue: 'inactive',
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (!data?.tenant) {
          if (req.user && (req.user as any).tenant) {
            data.tenant = (req.user as any).tenant;
          } else if (['admin', 'super-admin'].includes((req.user as any)?.role)) {
            try {
              const tenants = await (req as any).payload.find({
                collection: 'tenants',
                limit: 1,
                depth: 0,
              });
              if (tenants?.docs?.length > 0) {
                data.tenant = tenants.docs[0].id;
              }
            } catch {}
          }
        }
        return data;
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) {
        return { tenant: { equals: user.tenant } }
      }
      return false
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) return true
      return false
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) {
        return { tenant: { equals: user.tenant } }
      }
      return false
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) {
        return { tenant: { equals: user.tenant } }
      }
      return false
    },
  },
}
