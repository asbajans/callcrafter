import type { MediaAdapter, CallSession, IncomingCallPayload, MediaConfig } from './adapters/MediaAdapter';
import { getPayload } from 'payload'
import config from '@payload-config'

export class MediaRouter {
  private adapters = new Map<string, MediaAdapter>();

  registerAdapter(adapter: MediaAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`MediaRouter: adapter for provider '${adapter.provider}' is already registered`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  async getAdapterForTenant(tenantId: string): Promise<MediaAdapter> {
    const payload = await getPayload({ config })
    const providers = await payload.find({
      collection: 'provider-configs',
      where: { and: [{ isActive: { equals: true } }, { tenant: { equals: tenantId } }] },
      limit: 1,
    })

    if (providers.docs.length > 0) {
      const providerConfig = providers.docs[0]
      const provider = providerConfig.provider as string
      const adapter = this.adapters.get(provider)
      if (adapter) return adapter
    }

    const first = this.adapters.values().next().value
    if (first) return first

    throw new Error(`MediaRouter: no adapter registered for tenant ${tenantId}`)
  }

  async getAdapterForProvider(provider: string): Promise<MediaAdapter> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`MediaRouter: no adapter registered for provider '${provider}'`);
    }
    return adapter;
  }

  async handleIncomingCall(provider: string, payload: IncomingCallPayload): Promise<CallSession> {
    const adapter = await this.getAdapterForProvider(provider);
    return adapter.handleIncomingCall(payload);
  }
}
