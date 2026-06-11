import type { CollectionConfig } from 'payload'

export const WebhookLogs: CollectionConfig = {
  slug: 'webhook-logs',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'eventType',
      type: 'text',
      required: true,
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'ElevenLabs', value: 'elevenlabs' },
        { label: 'Twilio', value: 'twilio' },
        { label: 'Zadarma', value: 'zadarma' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Instagram', value: 'instagram' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
        { label: 'Retrying', value: 'retrying' },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'payload',
      type: 'json',
      required: true,
    },
    {
      name: 'response',
      type: 'json',
    },
    {
      name: 'error',
      type: 'textarea',
    },
    {
      name: 'retries',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'processedAt',
      type: 'date',
    },
  ],
  timestamps: true,
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      return ['admin', 'super-admin'].includes(user.role as string)
    },
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
