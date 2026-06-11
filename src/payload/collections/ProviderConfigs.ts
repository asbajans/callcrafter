import type { CollectionConfig } from 'payload'

export const ProviderConfigs: CollectionConfig = {
  slug: 'provider-configs',
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
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'Twilio', value: 'twilio' },
        { label: 'Zadarma', value: 'zadarma' },
        { label: 'Asterisk', value: 'asterisk' },
      ],
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Ours', value: 'ours' },
        { label: 'Own', value: 'own' },
      ],
      defaultValue: 'ours',
    },
    {
      name: 'config',
      type: 'json',
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'lastHealthCheck',
      type: 'date',
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
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) {
        return { tenant: { equals: user.tenant } }
      }
      return false
    },
  },
}
