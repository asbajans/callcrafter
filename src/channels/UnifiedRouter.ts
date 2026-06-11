interface RoutingInput {
  channel: 'voice' | 'whatsapp' | 'instagram' | 'web';
  tenantId: string;
  contact: Record<string, unknown>;
  content: string;
  mediaUrl?: string;
  rawPayload?: Record<string, unknown>;
}

interface RoutingResult {
  agentId: string;
  conversationId: string;
}

export interface AgentMapping {
  agentId: string;
  tenantId: string;
  channel: string;
  contactId: string;
  phoneNumber?: string;
}

export class UnifiedRouter {
  private agentMappings: Map<string, AgentMapping[]> = new Map();
  private conversationCounter = 0;

  async route(input: RoutingInput): Promise<RoutingResult> {
    const { channel, tenantId, contact, content } = input;

    let agentId: string | null = null;

    if (channel === 'voice' || channel === 'whatsapp') {
      const phoneNumber = contact.phoneNumber as string | undefined;
      if (phoneNumber) {
        agentId = await this.findAgentByPhoneNumber(phoneNumber, tenantId);
      }
    }

    if (!agentId) {
      const contactId = String(contact.id ?? contact.contactId ?? '');
      if (contactId) {
        agentId = await this.findAgentByContact(channel, contactId, tenantId);
      }
    }

    if (!agentId) {
      agentId = await this.resolveFallbackAgent(tenantId, channel);
    }

    if (!agentId) {
      throw new Error(
        `No available agent found for tenant ${tenantId} on channel ${channel}`
      );
    }

    const conversationId = this.generateConversationId(tenantId, channel, agentId);

    await this.registerMapping({
      agentId,
      tenantId,
      channel,
      contactId: String(contact.id ?? contact.contactId ?? content.slice(0, 20)),
      phoneNumber: contact.phoneNumber as string | undefined,
    });

    return { agentId, conversationId };
  }

  async findAgentByPhoneNumber(
    phoneNumber: string,
    tenantId: string
  ): Promise<string | null> {
    const tenantMappings = this.agentMappings.get(tenantId);
    if (!tenantMappings) return null;

    const mapping = tenantMappings.find(
      (m) => m.phoneNumber === phoneNumber
    );
    return mapping?.agentId ?? null;
  }

  async findAgentByContact(
    channel: string,
    contactId: string,
    tenantId: string
  ): Promise<string | null> {
    const tenantMappings = this.agentMappings.get(tenantId);
    if (!tenantMappings) return null;

    const mapping = tenantMappings.find(
      (m) => m.channel === channel && m.contactId === contactId
    );
    return mapping?.agentId ?? null;
  }

  async registerMapping(mapping: AgentMapping): Promise<void> {
    const existing = this.agentMappings.get(mapping.tenantId) ?? [];
    const idx = existing.findIndex(
      (m) =>
        m.channel === mapping.channel &&
        m.contactId === mapping.contactId
    );

    if (idx >= 0) {
      existing[idx] = mapping;
    } else {
      existing.push(mapping);
    }

    this.agentMappings.set(mapping.tenantId, existing);
  }

  async unregisterMapping(
    tenantId: string,
    channel: string,
    contactId: string
  ): Promise<void> {
    const existing = this.agentMappings.get(tenantId) ?? [];
    const filtered = existing.filter(
      (m) => !(m.channel === channel && m.contactId === contactId)
    );

    if (filtered.length > 0) {
      this.agentMappings.set(tenantId, filtered);
    } else {
      this.agentMappings.delete(tenantId);
    }
  }

  async getTenantMappings(tenantId: string): Promise<AgentMapping[]> {
    return this.agentMappings.get(tenantId) ?? [];
  }

  private async resolveFallbackAgent(
    tenantId: string,
    channel: string
  ): Promise<string | null> {
    const tenantMappings = this.agentMappings.get(tenantId);
    if (!tenantMappings || tenantMappings.length === 0) return null;

    const channelMappings = tenantMappings.filter(
      (m) => m.channel === channel
    );
    if (channelMappings.length > 0) {
      return channelMappings[0].agentId;
    }

    return tenantMappings[0].agentId;
  }

  private generateConversationId(
    tenantId: string,
    channel: string,
    agentId: string
  ): string {
    this.conversationCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.conversationCounter.toString(36);
    return `conv_${tenantId}_${channel}_${agentId}_${timestamp}_${counter}`;
  }
}
