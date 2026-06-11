import type { CollectionConfig } from 'payload'

export const SipTrunks: CollectionConfig = {
  slug: 'sip-trunks',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
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
        { label: 'Generic', value: 'generic' },
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
      name: 'credentials',
      type: 'json',
    },
    {
      name: 'codecs',
      type: 'json',
    },
    {
      name: 'dtmfMode',
      type: 'select',
      options: [
        { label: 'RFC 2833', value: 'rfc2833' },
        { label: 'SIP Info', value: 'sipinfo' },
        { label: 'Inband', value: 'inband' },
      ],
      defaultValue: 'rfc2833',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Error', value: 'error' },
        { label: 'Testing', value: 'testing' },
      ],
      defaultValue: 'active',
    },
    {
      name: 'lastHealthCheck',
      type: 'date',
    },
    {
      name: 'errorMessage',
      type: 'text',
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
