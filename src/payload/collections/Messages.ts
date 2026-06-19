import type { CollectionConfig } from 'payload'

export const Messages: CollectionConfig = {
  slug: 'messages',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'conversations',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'User', value: 'user' },
        { label: 'Assistant', value: 'assistant' },
        { label: 'System', value: 'system' },
        { label: 'Tool', value: 'tool' },
      ],
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'contentType',
      type: 'select',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Voice', value: 'voice' },
        { label: 'Image', value: 'image' },
        { label: 'File', value: 'file' },
      ],
      defaultValue: 'text',
    },
    {
      name: 'audioUrl',
      type: 'text',
    },
    {
      name: 'fileUrl',
      type: 'text',
    },
    {
      name: 'tokens',
      type: 'number',
    },
    {
      name: 'toolCalls',
      type: 'json',
    },
    {
      name: 'metadata',
      type: 'json',
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.tenant) {
        return { tenant: { equals: user.tenant } }
      }
      return false
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.tenant) return true
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
