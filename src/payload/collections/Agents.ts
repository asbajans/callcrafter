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
      label: 'Voice ID (Piper)',
    },
    {
      name: 'voiceName',
      type: 'text',
      label: 'Voice Display Name',
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
      name: 'model',
      type: 'select',
      options: [
        { label: 'GPT-4', value: 'gpt-4' },
        { label: 'GPT-4o', value: 'gpt-4o' },
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { label: 'Claude 3 Opus', value: 'claude-3-opus' },
        { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
        { label: 'Claude 3 Haiku', value: 'claude-3-haiku' },
      ],
      defaultValue: 'gpt-4o',
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
