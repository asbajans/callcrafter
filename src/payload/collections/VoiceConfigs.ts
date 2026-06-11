import type { CollectionConfig } from 'payload'

export const VoiceConfigs: CollectionConfig = {
  slug: 'voice-configs',
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
      options: [
        { label: 'ElevenLabs', value: 'elevenlabs' },
        { label: 'Google Cloud', value: 'google' },
        { label: 'Azure', value: 'azure' },
      ],
      defaultValue: 'elevenlabs',
    },
    {
      name: 'providerVoiceId',
      type: 'text',
      required: true,
    },
    {
      name: 'language',
      type: 'select',
      options: [
        { label: 'Türkçe', value: 'tr' },
        { label: 'English', value: 'en' },
        { label: 'Español', value: 'es' },
        { label: 'Français', value: 'fr' },
        { label: 'Deutsch', value: 'de' },
      ],
      defaultValue: 'tr',
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
      ],
    },
    {
      name: 'accent',
      type: 'text',
    },
    {
      name: 'isCloned',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'sampleUrl',
      type: 'text',
    },
    {
      name: 'previewUrl',
      type: 'text',
    },
    {
      name: 'settings',
      type: 'json',
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['admin', 'super-admin'].includes(user.role as string)) return true
      if (user.role === 'tenant-admin' && user.tenant) return true
      return true
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
