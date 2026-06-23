import type { CollectionConfig } from 'payload'

export const TenantCredits: CollectionConfig = {
  slug: 'tenant-credits',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'tenant',
    group: 'Billing',
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      unique: true,
    },
    {
      name: 'balance',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'totalPurchased',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'totalUsed',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'totalExpired',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'earliestExpiry',
      type: 'date',
      admin: {
        description: 'Earliest credit expiry date (auto-calculated)',
      },
    },
    {
      name: 'lastTopUpAt',
      type: 'date',
    },
    {
      name: 'monthlyLimit',
      type: 'number',
      admin: {
        description: 'Monthly credit usage limit (0 = unlimited)',
      },
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
