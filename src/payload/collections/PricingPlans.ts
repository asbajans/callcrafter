import type { CollectionConfig } from 'payload'

export const PricingPlans: CollectionConfig = {
  slug: 'pricing-plans',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'price',
      type: 'number',
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'usd',
    },
    {
      name: 'stripePriceId',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'stripeProductId',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'billingCycle',
      type: 'select',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
        { label: 'One Time', value: 'one_time' },
      ],
      defaultValue: 'monthly',
    },
    {
      name: 'features',
      type: 'array',
      fields: [
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'value',
          type: 'text',
        },
        {
          name: 'included',
          type: 'checkbox',
        },
      ],
    },
    {
      name: 'limits',
      type: 'json',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Deprecated', value: 'deprecated' },
      ],
      defaultValue: 'active',
    },
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 0,
    },
  ],
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
