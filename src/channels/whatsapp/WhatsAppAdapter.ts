export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  businessAccountId?: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'audio' | 'document' | 'interactive';
  text?: string;
  mediaUrl?: string;
  timestamp: Date;
}

export class WhatsAppAdapter {
  private config: WhatsAppConfig;
  private baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.accessToken}`,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`WhatsApp API error (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  async sendText(to: string, text: string, previewUrl?: boolean): Promise<any> {
    return this.request('POST', `${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: previewUrl ?? false },
    });
  }

  async sendTemplate(to: string, templateName: string, components?: any[]): Promise<any> {
    return this.request('POST', `${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: components ?? [],
      },
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.request('POST', `${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await this.request<{ url: string; mime_type: string }>('GET', `${mediaId}`);
    return response.url;
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    const mediaUrl = await this.getMediaUrl(mediaId);

    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | false {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    return false;
  }

  handleWebhook(body: any): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = [];

    if (!body?.entry) {
      return messages;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        if (!value?.messages) continue;

        for (const msg of value.messages) {
          const message: WhatsAppMessage = {
            id: msg.id,
            from: msg.from,
            to: value.metadata?.phone_number_id ?? '',
            type: msg.type ?? 'text',
            timestamp: new Date(msg.timestamp * 1000),
          };

          if (msg.type === 'text' && msg.text?.body) {
            message.text = msg.text.body;
          }

          if (msg.type !== 'text' && msg.image?.id) {
            message.mediaUrl = msg.image.id;
          } else if (msg.audio?.id) {
            message.mediaUrl = msg.audio.id;
          } else if (msg.document?.id) {
            message.mediaUrl = msg.document.id;
          }

          messages.push(message);
        }
      }
    }

    return messages;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request<any>('GET', `${this.config.phoneNumberId}`);
      return true;
    } catch {
      return false;
    }
  }
}
