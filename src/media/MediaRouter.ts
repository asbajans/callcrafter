import type { MediaAdapter, CallSession, IncomingCallPayload, MediaConfig } from './adapters/MediaAdapter';

export class MediaRouter {
  private adapters = new Map<string, MediaAdapter>();

  registerAdapter(adapter: MediaAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`MediaRouter: adapter for provider '${adapter.provider}' is already registered`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  async getAdapterForTenant(tenantId: string): Promise<MediaAdapter> {
    // In production, load tenant's media provider config from DB
    // and resolve the matching adapter.
    // For now, return first non-asterisk adapter or throw.
    for (const [, adapter] of this.adapters) {
      if (adapter.provider !== 'asterisk') {
        return adapter;
      }
    }

    const first = this.adapters.values().next().value;
    if (first) {
      return first;
    }

    throw new Error(`MediaRouter: no adapter registered for tenant ${tenantId}`);
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
