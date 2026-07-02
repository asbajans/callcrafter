import type { CollectionConfig } from 'payload'
import { StripeService } from '@/billing/StripeService'

async function syncStripeProduct(data: any, originalDoc?: any) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return data

  const price = typeof data.price === 'number' ? data.price : parseFloat(data.price)
  if (price <= 0) return data

  const name = data.name || originalDoc?.name
  const description = data.description || originalDoc?.description
  const billingCycle = data.billingCycle || originalDoc?.billingCycle
  const existingPriceId = data.stripePriceId || originalDoc?.stripePriceId
  const existingProductId = data.stripeProductId || originalDoc?.stripeProductId
  const oldPrice = originalDoc?.price

  // If price didn't change and we already have Stripe IDs, skip
  if (existingPriceId && oldPrice === price) return data

  const stripeService = new StripeService(stripeKey)

  try {
    // If product already exists in Stripe, update it; otherwise create
    let productId = existingProductId

    if (productId) {
      await stripeService['stripe'].products.update(productId, { name, description })
    } else {
      const product = await stripeService['stripe'].products.create({ name, description: description || '' })
      productId = product.id
    }

    // Determine interval from billing cycle
    const interval = billingCycle === 'yearly' ? 'year' as const : billingCycle === 'monthly' ? 'month' as const : undefined

    const stripePrice = await stripeService['stripe'].prices.create({
      product: productId,
      unit_amount: Math.round(price * 100),
      currency: 'usd',
      recurring: interval ? { interval } : undefined,
    })

    // Deactivate old price if it exists and differs
    if (existingPriceId && existingPriceId !== stripePrice.id) {
      try {
        await stripeService['stripe'].prices.update(existingPriceId, { active: false })
      } catch { /* non-critical */ }
    }

    data.stripeProductId = productId
    data.stripePriceId = stripePrice.id
  } catch (e) {
    console.error('Stripe sync failed for plan:', name, e)
  }

  return data
}

export const PricingPlans: CollectionConfig = {
  slug: 'pricing-plans',
  admin: {
    useAsTitle: 'name',
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc }) => {
        return syncStripeProduct(data, originalDoc)
      },
    ],
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
