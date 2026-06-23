import type { CollectionConfig } from 'payload'

export const CreditPackages: CollectionConfig = {
  slug: 'credit-packages',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
  },
  fields: [
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
      name: 'credits',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'usd',
    },
    {
      name: 'durationMonths',
      type: 'number',
      defaultValue: 6,
      admin: {
        description: 'Credits expire after this many months',
      },
    },
    {
      name: 'stripePriceId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'stripeProductId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 0,
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
