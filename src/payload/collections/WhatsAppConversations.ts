import type { CollectionConfig } from 'payload'

export const WhatsAppConversations: CollectionConfig = {
  slug: 'whatsapp-conversations',
  defaultSort: '-lastMessageAt',
  admin: {
    useAsTitle: 'contactPhone',
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'whatsapp-accounts' as any,
      required: true,
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'agent',
      type: 'relationship',
      relationTo: 'agents',
    },
    {
      name: 'contactPhone',
      type: 'text',
      required: true,
    },
    {
      name: 'contactName',
      type: 'text',
    },
    {
      name: 'contactJid',
      type: 'text',
    },
    {
      name: 'profilePictureUrl',
      type: 'text',
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Pending', value: 'pending' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Closed', value: 'closed' },
      ],
      defaultValue: 'open',
    },
    {
      name: 'unreadCount',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'lastMessageAt',
      type: 'date',
    },
    {
      name: 'lastMessagePreview',
      type: 'text',
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
