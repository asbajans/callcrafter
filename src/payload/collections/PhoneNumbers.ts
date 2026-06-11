import type { CollectionConfig } from 'payload'

export const PhoneNumbers: CollectionConfig = {
  slug: 'phone-numbers',
  admin: {
    useAsTitle: 'number',
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'number',
      type: 'text',
      required: true,
    },
    {
      name: 'friendlyName',
      type: 'text',
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Mobile', value: 'mobile' },
        { label: 'Landline', value: 'landline' },
        { label: 'Toll Free', value: 'tollfree' },
      ],
      defaultValue: 'mobile',
    },
    {
      name: 'provider',
      type: 'select',
      options: [
        { label: 'Twilio', value: 'twilio' },
        { label: 'Zadarma', value: 'zadarma' },
        { label: 'Asterisk', value: 'asterisk' },
        { label: 'Own SIP', value: 'own_sip' },
      ],
      defaultValue: 'twilio',
    },
    {
      name: 'providerConfig',
      type: 'relationship',
      relationTo: 'provider-configs',
    },
    {
      name: 'sipTrunk',
      type: 'relationship',
      relationTo: 'sip-trunks',
    },
    {
      name: 'isOwnNumber',
      type: 'checkbox',
    },
    {
      name: 'forwardTo',
      type: 'relationship',
      relationTo: 'agents',
    },
    {
      name: 'twilioSid',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'capabilities',
      type: 'json',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Porting', value: 'porting' },
        { label: 'Suspended', value: 'suspended' },
      ],
      defaultValue: 'active',
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
