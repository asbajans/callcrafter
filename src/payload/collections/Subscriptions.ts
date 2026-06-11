import type { CollectionConfig } from 'payload'

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
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
      name: 'plan',
      type: 'relationship',
      relationTo: 'pricing-plans',
      required: true,
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      unique: true,
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Trialing', value: 'trialing' },
      ],
      defaultValue: 'trialing',
    },
    {
      name: 'currentPeriodStart',
      type: 'date',
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
    },
    {
      name: 'trialEnd',
      type: 'date',
    },
    {
      name: 'cancelledAt',
      type: 'date',
    },
    {
      name: 'usage',
      type: 'json',
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
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
      return ['admin', 'super-admin'].includes(user.role as string)
    },
  },
}
