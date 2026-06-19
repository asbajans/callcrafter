import type { CollectionConfig } from 'payload'
import { headers } from 'next/headers'

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'agent',
      type: 'relationship',
      relationTo: 'agents',
    },
    {
      name: 'channel',
      type: 'select',
      required: true,
      options: [
        { label: 'Voice', value: 'voice' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Instagram', value: 'instagram' },
        { label: 'Web', value: 'web' },
      ],
    },
    {
      name: 'externalId',
      type: 'text',
    },
    {
      name: 'contact',
      type: 'json',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
        { label: 'Missed', value: 'missed' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'active',
    },
    {
      name: 'startTime',
      type: 'date',
      required: true,
    },
    {
      name: 'endTime',
      type: 'date',
    },
    {
      name: 'duration',
      type: 'number',
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      name: 'sentiment',
      type: 'select',
      options: [
        { label: 'Positive', value: 'positive' },
        { label: 'Neutral', value: 'neutral' },
        { label: 'Negative', value: 'negative' },
      ],
    },
    {
      name: 'tags',
      type: 'json',
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
      if (user.role === 'user' && user.tenant) {
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
      return ['admin', 'super-admin'].includes(user.role as string)
    },
  },
}
