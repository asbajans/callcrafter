import type { CollectionConfig } from 'payload'

export const WhatsAppAccounts: CollectionConfig = {
  slug: 'whatsapp-accounts',
  defaultSort: '-createdAt',
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
      name: 'phoneNumberId',
      type: 'text',
      required: true,
    },
    {
      name: 'businessAccountId',
      type: 'text',
    },
    {
      name: 'accessToken',
      type: 'text',
    },
    {
      name: 'webhookVerifyToken',
      type: 'text',
    },
    {
      name: 'displayPhoneNumber',
      type: 'text',
    },
    {
      name: 'connectionType',
      type: 'select',
      options: [
        { label: 'Cloud API', value: 'cloud_api' },
        { label: 'QR Bridge', value: 'qr' },
      ],
      defaultValue: 'cloud_api',
    },
    {
      name: 'qrSessionId',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.connectionType === 'qr',
      },
    },
    {
      name: 'qrCodeData',
      type: 'textarea',
      admin: {
        condition: (_, siblingData) => siblingData.connectionType === 'qr',
      },
    },
    {
      name: 'qrStatus',
      type: 'select',
      options: [
        { label: 'Idle', value: 'idle' },
        { label: 'Connecting', value: 'connecting' },
        { label: 'Connected', value: 'connected' },
        { label: 'Disconnected', value: 'disconnected' },
      ],
      defaultValue: 'idle',
      admin: {
        condition: (_, siblingData) => siblingData.connectionType === 'qr',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'metadata',
      type: 'json',
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
