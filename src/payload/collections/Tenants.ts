import type { CollectionConfig } from 'payload'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
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
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'website',
      type: 'text',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'industry',
      type: 'select',
      options: [
        { label: 'Healthcare', value: 'healthcare' },
        { label: 'Finance', value: 'finance' },
        { label: 'Retail', value: 'retail' },
        { label: 'Real Estate', value: 'real_estate' },
        { label: 'Education', value: 'education' },
        { label: 'Technology', value: 'technology' },
        { label: 'Hospitality', value: 'hospitality' },
        { label: 'Logistics', value: 'logistics' },
        { label: 'Insurance', value: 'insurance' },
        { label: 'Telecommunications', value: 'telecommunications' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Trial', value: 'trial' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'trial',
    },
    {
      name: 'trialEndDate',
      type: 'date',
    },
    {
      name: 'subscription',
      type: 'relationship',
      relationTo: 'subscriptions',
    },
    {
      name: 'defaultProvider',
      type: 'select',
      options: [
        { label: 'Twilio', value: 'twilio' },
        { label: 'Zadarma', value: 'zadarma' },
        { label: 'Asterisk', value: 'asterisk' },
      ],
      defaultValue: 'twilio',
    },
    {
      name: 'settings',
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
        return { id: { equals: user.tenant } }
      }
      return false
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      return ['admin', 'super-admin'].includes(user.role as string)
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) {
        return { id: { equals: user.tenant } }
      }
      return false
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return ['admin', 'super-admin'].includes(user.role as string)
    },
  },
}
