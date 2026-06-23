import type { CollectionConfig } from 'payload'

export const CreditTransactions: CollectionConfig = {
  slug: 'credit-transactions',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'description',
    group: 'Billing',
    defaultColumns: ['tenant', 'type', 'amount', 'balanceAfter', 'createdAt'],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Purchase', value: 'purchase' },
        { label: 'Manual Add', value: 'manual_add' },
        { label: 'Usage', value: 'usage' },
        { label: 'Expired', value: 'expired' },
        { label: 'Refund', value: 'refund' },
        { label: 'Adjustment', value: 'adjustment' },
      ],
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
    },
    {
      name: 'balanceBefore',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'balanceAfter',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'Admin', value: 'admin' },
        { label: 'Usage', value: 'usage' },
        { label: 'System', value: 'system' },
      ],
      defaultValue: 'admin',
    },
    {
      name: 'description',
      type: 'text',
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'When these credits expire (set on purchase/manual add)',
      },
    },
    {
      name: 'creditPackage',
      type: 'relationship',
      relationTo: 'credit-packages' as any,
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
      return ['admin', 'super-admin', 'tenant-admin'].includes(user.role as string)
    },
    update: () => false,
    delete: () => false,
  },
}
