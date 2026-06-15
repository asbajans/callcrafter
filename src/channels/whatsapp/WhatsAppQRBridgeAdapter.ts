export interface WhatsAppQRBridgeConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret?: string;
}

export interface QrSessionInfo {
  sessionId: string;
  qrCode: string;
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
}

interface EvolutionInstance {
  instance: { instanceName: string; status: string };
  hash?: { qrcode?: { code?: string; pairingCode?: string } };
}

export class WhatsAppQRBridgeAdapter {
  private config: WhatsAppQRBridgeConfig;

  constructor(config: WhatsAppQRBridgeConfig) {
    this.config = config;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}/${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.config.apiKey,
    };

    const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`QR Bridge API error (${response.status}): ${errorBody}`);
    }
    return response.json() as Promise<T>;
  }

  async startSession(sessionId: string): Promise<QrSessionInfo> {
    const exists = await this.instanceExists(sessionId);
    if (!exists) {
      await this.request('POST', `instance/create`, {
        instanceName: sessionId,
        qrcode: true,
        integration: 'WHATSAPP_BETA',
      });
    }

    const instance = await this.request<EvolutionInstance>('GET', `instance/connect/${sessionId}`);

    return {
      sessionId,
      qrCode: instance.hash?.qrcode?.code ?? '',
      status: this.mapStatus(instance.instance?.status),
    };
  }

  async getSessionStatus(sessionId: string): Promise<QrSessionInfo> {
    const instance = await this.request<EvolutionInstance>('GET', `instance/connectionState/${sessionId}`);
    return {
      sessionId,
      qrCode: '',
      status: this.mapStatus(instance?.instance?.status),
    };
  }

  async disconnectSession(sessionId: string): Promise<void> {
    await this.request('POST', `instance/logout/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `instance/delete/${sessionId}`);
  }

  async sendText(sessionId: string, to: string, text: string): Promise<any> {
    return this.request('POST', `message/sendText/${sessionId}`, {
      number: to,
      text,
      delay: 1200,
    });
  }

  async sendMedia(sessionId: string, to: string, mediaType: string, mediaUrl: string, caption?: string): Promise<any> {
    return this.request('POST', `message/sendMedia/${sessionId}`, {
      number: to,
      mediatype: mediaType,
      media: mediaUrl,
      caption: caption ?? '',
      delay: 1200,
    });
  }

  async markAsRead(sessionId: string, messageId: string): Promise<void> {
    await this.request('POST', `message/sendRead/${sessionId}`, {
      messageId,
    });
  }

  async setWebhook(sessionId: string, webhookUrl: string): Promise<void> {
    await this.request('POST', `instance/setWebhook/${sessionId}`, {
      webhook: { url: webhookUrl, events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'] },
    });
  }

  verifyWebhook(body: any): boolean {
    if (!this.config.webhookSecret) return true;
    return body?.secret === this.config.webhookSecret;
  }

  handleWebhook(body: any): { messages: any[]; statuses: any[]; connectionUpdate?: any } {
    const result: { messages: any[]; statuses: any[]; connectionUpdate?: any } = {
      messages: [],
      statuses: [],
    };

    if (!body) return result;

    if (body.event === 'CONNECTION_UPDATE') {
      result.connectionUpdate = {
        instanceName: body.instance,
        state: body.data?.state,
      };
      return result;
    }

    if (body.event === 'MESSAGES_UPSERT' && body.data?.key?.remoteJid) {
      const msg = body.data;
      const remoteJid = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const pushName = msg.pushName;
      const messageType = Object.keys(msg.message ?? {})[0];
      const messageContent = msg.message?.[messageType];

      result.messages.push({
        id: msg.key.id,
        from: isFromMe ? 'me' : remoteJid.replace(/@s\.whatsapp\.net$/, ''),
        to: isFromMe ? remoteJid.replace(/@s\.whatsapp\.net$/, '') : 'me',
        type: messageType?.replace('Message', '').toLowerCase() ?? 'text',
        text: messageContent?.conversation ?? messageContent?.textMessage?.body ?? messageContent?.extendedTextMessage?.text,
        mediaUrl: messageContent?.imageMessage?.url ?? messageContent?.videoMessage?.url ?? messageContent?.audioMessage?.url ?? messageContent?.documentMessage?.url,
        mediaCaption: messageContent?.imageMessage?.caption ?? messageContent?.videoMessage?.caption,
        timestamp: new Date(msg.messageTimestamp * 1000),
        pushName,
        remoteJid,
      });
    }

    if (body.event === 'MESSAGES_UPDATE' && body.data?.key?.remoteJid) {
      const update = body.data;
      result.statuses.push({
        messageId: update.key.id,
        status: update.status === 'READ' ? 'read' : update.status === 'DELIVERED' ? 'delivered' : 'sent',
        recipientId: update.key.remoteJid.replace(/@s\.whatsapp\.net$/, ''),
        timestamp: new Date(),
      });
    }

    return result;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request<any>('GET', 'instance/fetchInstances');
      return true;
    } catch {
      return false;
    }
  }

  private async instanceExists(sessionId: string): Promise<boolean> {
    try {
      const instances = await this.request<{ instance: { instanceName: string }[] }>('GET', 'instance/fetchInstances');
      return instances.instance?.some((i: any) => i.instanceName === sessionId) ?? false;
    } catch {
      return false;
    }
  }

  private mapStatus(status: string): QrSessionInfo['status'] {
    switch (status) {
      case 'open':
      case 'connected':
        return 'connected';
      case 'connecting':
      case 'syncing':
        return 'connecting';
      case 'disconnected':
      case 'closed':
        return 'disconnected';
      default:
        return 'idle';
    }
  }
}
