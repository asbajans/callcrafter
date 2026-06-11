export interface InstagramConfig {
  accessToken: string;
  igUserId: string;
  appSecret: string;
  webhookVerifyToken: string;
}

export interface InstagramMessage {
  id: string;
  from: string;
  text?: string;
  mediaUrl?: string;
  timestamp: Date;
}

interface InstagramRecipient {
  id: string;
}

interface InstagramMessageResponse {
  message_id: string;
}

export class InstagramAdapter {
  private config: InstagramConfig;
  private baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(config: InstagramConfig) {
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
      throw new Error(`Instagram API error (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  async sendText(igRecipientId: string, text: string): Promise<any> {
    return this.request<InstagramMessageResponse>(
      'POST',
      `${this.config.igUserId}/messages`,
      {
        recipient: { id: igRecipientId } as InstagramRecipient,
        message: { text },
      }
    );
  }

  async sendImage(igRecipientId: string, imageUrl: string): Promise<any> {
    return this.request<InstagramMessageResponse>(
      'POST',
      `${this.config.igUserId}/messages`,
      {
        recipient: { id: igRecipientId } as InstagramRecipient,
        message: {
          attachment: {
            type: 'image',
            payload: { url: imageUrl },
          },
        },
      }
    );
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | false {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    return false;
  }

  handleWebhook(body: any): InstagramMessage[] {
    const messages: InstagramMessage[] = [];

    if (!body?.entry) {
      return messages;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        if (!value?.messages) continue;

        for (const msg of value.messages) {
          const message: InstagramMessage = {
            id: msg.id,
            from: msg.from?.username ?? msg.from?.id ?? 'unknown',
            timestamp: new Date(msg.timestamp * 1000),
          };

          if (msg.text) {
            message.text = msg.text;
          }

          const attachment = msg.attachments?.[0];
          if (attachment?.payload?.uri) {
            message.mediaUrl = attachment.payload.uri;
          } else if (attachment?.payload?.url) {
            message.mediaUrl = attachment.payload.url;
          }

          messages.push(message);
        }
      }
    }

    return messages;
  }
}
