import type { CollectionConfig } from 'payload'

export const WhatsAppMessages: CollectionConfig = {
  slug: 'whatsapp-messages',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'whatsapp-conversations' as any,
      required: true,
    },
    {
      name: 'whatsAppMessageId',
      type: 'text',
    },
    {
      name: 'direction',
      type: 'select',
      required: true,
      options: [
        { label: 'Inbound', value: 'inbound' },
        { label: 'Outbound', value: 'outbound' },
      ],
    },
    {
      name: 'messageType',
      type: 'select',
      required: true,
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Image', value: 'image' },
        { label: 'Video', value: 'video' },
        { label: 'Audio', value: 'audio' },
        { label: 'Document', value: 'document' },
        { label: 'Location', value: 'location' },
        { label: 'Sticker', value: 'sticker' },
        { label: 'Template', value: 'template' },
        { label: 'Interactive', value: 'interactive' },
        { label: 'Reaction', value: 'reaction' },
      ],
    },
    {
      name: 'body',
      type: 'textarea',
    },
    {
      name: 'mediaUrl',
      type: 'text',
    },
    {
      name: 'mediaMimeType',
      type: 'text',
    },
    {
      name: 'mediaCaption',
      type: 'text',
    },
    {
      name: 'templateName',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Read', value: 'read' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'sent',
    },
    {
      name: 'deliveredAt',
      type: 'date',
    },
    {
      name: 'readAt',
      type: 'date',
    },
    {
      name: 'sentBy',
      type: 'relationship',
      relationTo: 'users',
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
      return true
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      return true
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
