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
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker' | 'template' | 'interactive' | 'reaction' | 'order' | 'contacts' | 'button' | 'system';
  text?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaCaption?: string;
  latitude?: number;
  longitude?: number;
  stickerAnimated?: boolean;
  interactiveType?: string;
  interactiveReply?: string;
  reactionMessageId?: string;
  reactionEmoji?: string;
  contextMessageId?: string;
  timestamp: Date;
  name?: string;
}

export interface WhatsAppStatusUpdate {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipientId: string;
  timestamp: Date;
  error?: string;
}

export interface WhatsAppWebhookPayload {
  messages: WhatsAppMessage[];
  statuses: WhatsAppStatusUpdate[];
  accountPhoneNumber: string;
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
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: previewUrl ?? false },
    });
  }

  async sendMedia(to: string, mediaType: string, mediaUrl: string, caption?: string): Promise<any> {
    const mediaObj: Record<string, string> = { link: mediaUrl };
    if (caption) mediaObj.caption = caption;
    return this.request('POST', `${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: mediaType,
      [mediaType]: mediaObj,
    });
  }

  async sendTemplate(to: string, templateName: string, languageCode?: string, parameters?: { type: string; text: string }[]): Promise<any> {
    const template: Record<string, any> = {
      name: templateName,
      language: { code: languageCode || 'en' },
    };
    if (parameters && parameters.length > 0) {
      template.components = [
        { type: 'body', parameters: parameters.map(p => ({ type: p.type, text: p.text })) },
      ];
    }
    return this.request('POST', `${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template,
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.request('POST', `${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  async getMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const response = await this.request<{ url: string; mime_type: string }>('GET', `${mediaId}`);
    return { url: response.url, mimeType: response.mime_type };
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    const { url: mediaUrl } = await this.getMediaUrl(mediaId);
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

  handleWebhook(body: any): WhatsAppWebhookPayload {
    const result: WhatsAppWebhookPayload = {
      messages: [],
      statuses: [],
      accountPhoneNumber: '',
    };

    if (!body?.entry) return result;

    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        if (!value) continue;

        result.accountPhoneNumber = value.metadata?.phone_number_id ?? result.accountPhoneNumber;

        if (value.statuses) {
          for (const st of value.statuses) {
            result.statuses.push({
              messageId: st.id,
              status: st.status,
              recipientId: st.recipient_id,
              timestamp: new Date((st.timestamp ?? Date.now() / 1000) * 1000),
              error: st.errors?.[0]?.message,
            });
          }
        }

        if (!value.messages) continue;

        for (const msg of value.messages) {
          const message: WhatsAppMessage = {
            id: msg.id,
            from: msg.from,
            to: value.metadata?.phone_number_id ?? '',
            type: msg.type ?? 'text',
            timestamp: new Date((msg.timestamp ?? Date.now() / 1000) * 1000),
          };

          if (msg.context?.id) {
            message.contextMessageId = msg.context.id;
          }

          switch (msg.type) {
            case 'text':
              message.text = msg.text?.body;
              break;

            case 'image':
              message.mediaUrl = msg.image?.id;
              message.mediaMimeType = msg.image?.mime_type;
              message.mediaCaption = msg.image?.caption;
              break;

            case 'video':
              message.mediaUrl = msg.video?.id;
              message.mediaMimeType = msg.video?.mime_type;
              message.mediaCaption = msg.video?.caption;
              break;

            case 'audio':
              message.mediaUrl = msg.audio?.id;
              message.mediaMimeType = msg.audio?.mime_type;
              break;

            case 'document':
              message.mediaUrl = msg.document?.id;
              message.mediaMimeType = msg.document?.mime_type;
              message.mediaCaption = msg.document?.caption;
              break;

            case 'location':
              message.latitude = msg.location?.latitude;
              message.longitude = msg.location?.longitude;
              message.text = msg.location?.name ? `${msg.location.name}: ${msg.location.latitude},${msg.location.longitude}` : `${msg.location?.latitude},${msg.location?.longitude}`;
              break;

            case 'sticker':
              message.mediaUrl = msg.sticker?.id;
              message.mediaMimeType = msg.sticker?.mime_type;
              message.stickerAnimated = msg.sticker?.animated;
              break;

            case 'contacts':
              message.name = msg.contacts?.[0]?.name?.formatted_name;
              break;

            case 'interactive':
              message.interactiveType = msg.interactive?.type;
              message.interactiveReply = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title;
              message.text = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? msg.interactive?.body?.text;
              break;

            case 'reaction':
              message.reactionMessageId = msg.reaction?.message_id;
              message.reactionEmoji = msg.reaction?.emoji;
              break;

            case 'order':
              message.text = `Order: ${msg.order?.catalog_id}`;
              break;

            case 'button':
              message.text = msg.button?.text;
              break;
          }

          result.messages.push(message);
        }
      }
    }

    return result;
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
