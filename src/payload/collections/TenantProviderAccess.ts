import type { CollectionConfig } from 'payload'

export const TenantProviderAccess: CollectionConfig = {
  slug: 'tenant-provider-access',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'tenant',
    group: 'AI',
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'ai-providers' as any,
      required: true,
    },
    {
      name: 'allowedModels',
      type: 'json',
      admin: {
        description: 'Array of allowed model IDs (null = all models)',
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
        description: 'Override provider credit multiplier for this tenant',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
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
