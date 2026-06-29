import type { CollectionConfig } from 'payload'

export const AiProviders: CollectionConfig = {
  slug: 'ai-providers',
  defaultSort: 'name',
  admin: {
    useAsTitle: 'name',
    group: 'AI',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'displayName',
      type: 'text',
    },
    {
      name: 'providerType',
      type: 'select',
      required: true,
      defaultValue: 'openai',
      options: [
        { label: 'OpenAI', value: 'openai' },
        { label: 'Anthropic', value: 'anthropic' },
        { label: 'Gemini', value: 'gemini' },
        { label: 'OpenRouter', value: 'openrouter' },
        { label: 'Ollama', value: 'ollama' },
        { label: 'Custom', value: 'custom' },
      ],
    },
    {
      name: 'apiKey',
      type: 'text',
      admin: {
        hidden: true,
      },
      access: {
        read: () => false,
      },
    },
    {
      name: 'baseUrl',
      type: 'text',
      admin: {
        description: 'Custom API base URL (for OpenRouter, Ollama, Custom)',
      },
    },
    {
      name: 'models',
      type: 'json',
      required: true,
      admin: {
        description: 'Available models array: [{name, modelId, creditCost}]',
      },
    },
    {
      name: 'defaultModel',
      type: 'text',
    },
    {
      name: 'creditMultiplier',
      type: 'number',
      defaultValue: 1.0,
      min: 0,
      admin: {
        description: 'Global credit cost multiplier for this provider',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'isSystem',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'System provider (configured by super-admin for all tenants)',
      },
    },
  ],
  timestamps: true,
  access: {
    read: () => true,
    create: ({ req: { user } }) => {
      if (!user) return false
      return ['admin', 'super-admin'].includes(user.role as string)
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      return ['admin', 'super-admin'].includes(user.role as string)
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return ['admin', 'super-admin'].includes(user.role as string)
    },
  },
}
