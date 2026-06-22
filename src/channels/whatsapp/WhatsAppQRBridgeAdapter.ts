export interface WhatsAppQRBridgeConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret?: string;
}

export interface QrSessionInfo {
  sessionId: string;
  qrCode: string;
  qrImageUrl?: string;
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

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`QR Bridge API error (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  async startSession(sessionId: string, webhookUrl?: string): Promise<QrSessionInfo & { qrImageUrl?: string }> {
    // 1) POST /instance/create
    try {
      await this.request('POST', 'instance/create', {
        instanceName: sessionId,
        token: this.config.apiKey,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      });
    } catch (err: any) {
      // If it already exists, ignore and continue
      if (!err.message.includes('Forbidden') && !err.message.includes('already exists')) {
        throw err;
      }
    }

    // Wait 2000ms for instance to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Poll instance/connect for QR code
    let connectResult = await this.pollConnectForQr(sessionId);

    // If no QR code found and missing instance or disconnected, recreate once
    if (
      !connectResult.qrCode &&
      !connectResult.qrBase64 &&
      (connectResult.isMissingInstance || connectResult.status === 'disconnected')
    ) {
      try {
        await this.request('POST', 'instance/create', {
          instanceName: sessionId,
          token: this.config.apiKey,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        connectResult = await this.pollConnectForQr(sessionId);
      } catch (err) {
        // ignore and use the previous result
      }
    }

    const qrCode = connectResult.qrCode || '';
    const qrBase64 = connectResult.qrBase64 || '';
    const status = connectResult.status;

    let qrImageUrl = '';
    if (qrBase64) {
      qrImageUrl = qrBase64.startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`;
    } else if (qrCode) {
      qrImageUrl = `https://quickchart.io/qr?size=260&text=${encodeURIComponent(qrCode)}`;
    }

    // Ensure webhook is set
    if (webhookUrl) {
      await this.setWebhook(sessionId, webhookUrl).catch(() => {});
    }

    return {
      sessionId,
      qrCode,
      qrImageUrl,
      status: this.mapStatus(status),
    };
  }

  async getSessionStatus(sessionId: string): Promise<QrSessionInfo> {
    try {
      const connectData: any = await this.request('GET', `instance/connect/${sessionId}`);
      const rawState = this.findFirstString(connectData, ['state', 'status', 'connectionStatus']) || '';
      return {
        sessionId,
        qrCode: this.findFirstString(connectData, ['code', 'qrcode', 'qr', 'qrCode']) || '',
        status: this.mapStatus(rawState),
      };
    } catch {
      return {
        sessionId,
        qrCode: '',
        status: 'disconnected',
      };
    }
  }

  async disconnectSession(sessionId: string): Promise<void> {
    try {
      await this.request('DELETE', `instance/logout/${sessionId}`);
    } catch (err: any) {
      // fallback to POST if DELETE is not supported by older APIs
      try {
        await this.request('POST', `instance/logout/${sessionId}`);
      } catch {}
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `instance/delete/${sessionId}`);
  }

  async sendText(sessionId: string, to: string, text: string): Promise<any> {
    const number = to.replace('+', '').replace(/ /g, '').replace(/-/g, '');
    return this.request('POST', `message/sendText/${sessionId}`, {
      number,
      text,
      delay: 1200,
    });
  }

  async sendMedia(
    sessionId: string,
    to: string,
    mediaType: string,
    mediaUrl: string,
    caption?: string
  ): Promise<any> {
    const number = to.replace('+', '').replace(/ /g, '').replace(/-/g, '');
    const mappedType = ['video', 'audio', 'document'].includes((mediaType || '').toLowerCase())
      ? (mediaType || '').toLowerCase()
      : 'image';

    return this.request('POST', `message/sendMedia/${sessionId}`, {
      number,
      mediatype: mappedType,
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
    await this.request('POST', `webhook/set/${sessionId}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
      },
    });
  }

  verifyWebhook(body: any): boolean {
    // Evolution API webhooks come from internal Docker network — no secret validation needed
    return true;
  }

  handleWebhook(body: any): {
    messages: any[];
    statuses: any[];
    connectionUpdate?: { instanceName: string; state: 'open' | 'connecting' | 'disconnected' };
  } {
    const result: { messages: any[]; statuses: any[]; connectionUpdate?: any } = {
      messages: [],
      statuses: [],
    };

    if (!body) return result;

    const eventName = (body.event || body.eventType || '').toLowerCase();

    // 1) Connection update
    if (eventName === 'connection.update' || eventName === 'connection_update') {
      const data = body.data || body;
      const state = (data.state || data.status || '').toLowerCase();
      result.connectionUpdate = {
        instanceName: body.instance || data.instance || '',
        state: state.includes('open') || state.includes('connected') ? 'open'
          : state.includes('connecting') ? 'connecting'
          : 'disconnected',
      };
      return result;
    }

    // 2) Status updates
    if (
      eventName === 'messages.update' ||
      eventName === 'messages_update' ||
      eventName === 'status'
    ) {
      const items = Array.isArray(body.data) ? body.data : [body.data || body];
      for (const item of items) {
        const msgId = item.keyId || item.messageId || item.id;
        const statusRaw = (item.status || '').toLowerCase();
        if (msgId) {
          result.statuses.push({
            messageId: msgId,
            status: statusRaw.includes('read') || statusRaw.includes('seen') ? 'read'
              : statusRaw.includes('delivered') ? 'delivered'
              : statusRaw.includes('fail') || statusRaw.includes('error') ? 'failed'
              : 'sent',
            recipientId: this.normalizePhone(item.remoteJid || ''),
            timestamp: new Date(),
          });
        }
      }
      return result;
    }

    // 3) Messages (upsert/inbound)
    if (
      eventName === 'messages.upsert' ||
      eventName === 'messages_upsert' ||
      eventName === 'message' ||
      body.messages ||
      body.data?.message
    ) {
      const items = Array.isArray(body.data)
        ? body.data
        : body.messages && Array.isArray(body.messages)
        ? body.messages
        : [body.data || body];

      for (const item of items) {
        // Skip outbound messages (sent from us)
        if (item.key?.fromMe === true || item.fromMe === true) {
          continue;
        }

        const rawJid = item.key?.remoteJid || item.from || item.remoteJid || item.chatId || '';
        const normalizedJid = this.normalizeJid(rawJid);
        const from = this.normalizePhone(normalizedJid);

        if (!from) continue;

        const msgId = item.key?.id || item.messageId || item.id || item.keyId || '';

        // Extract body
        let bodyText = '';
        let caption = item.caption || '';
        const msgContent = item.message;

        if (msgContent && typeof msgContent === 'object') {
          bodyText = msgContent.conversation || msgContent.text || '';
          if (!bodyText && msgContent.extendedTextMessage) {
            bodyText = msgContent.extendedTextMessage.text || '';
          }
          if (!bodyText && msgContent.buttonsResponseMessage) {
            bodyText = msgContent.buttonsResponseMessage.selectedButtonId || '';
            caption = msgContent.buttonsResponseMessage.selectedDisplayText || '';
          }
          if (!bodyText && msgContent.listResponseMessage) {
            caption = msgContent.listResponseMessage.title || '';
            bodyText = msgContent.listResponseMessage.singleSelectReply?.selectedRowId || '';
          }
        }

        bodyText = bodyText || item.text || item.body || '';

        // Extract media
        let mediaUrl = item.mediaUrl || '';
        let mediaMimeType = item.mediaMimeType || item.mimeType || '';
        let typeRaw = (item.messageType || item.type || 'text').toLowerCase();

        if (msgContent && typeof msgContent === 'object') {
          for (const key of Object.keys(msgContent)) {
            if (key.endsWith('Message')) {
              typeRaw = key.replace('Message', '').toLowerCase();
              const mediaObj = msgContent[key];
              if (mediaObj && typeof mediaObj === 'object') {
                if (mediaObj.caption) caption = mediaObj.caption;
                if (mediaObj.url) mediaUrl = mediaObj.url;
                if (mediaObj.mimetype) mediaMimeType = mediaObj.mimetype;
              }
              break;
            }
          }
        }

        const pushName = item.pushName || item.fromName || item.contactName || '';
        const timestampRaw = item.messageTimestamp || item.timestamp;
        const timestamp = timestampRaw ? new Date(Number(timestampRaw) * 1000) : new Date();

        result.messages.push({
          id: msgId,
          from,
          to: 'me',
          type: ['image', 'video', 'audio', 'document', 'location', 'sticker', 'interactive'].includes(typeRaw)
            ? typeRaw
            : 'text',
          text: bodyText,
          mediaUrl,
          mediaCaption: caption,
          mediaMimeType,
          timestamp,
          pushName,
          remoteJid: normalizedJid,
        });
      }
    }

    return result;
  }

  healthCheck(): Promise<boolean> {
    return this.request('GET', 'instance/fetchInstances')
      .then(() => true)
      .catch(() => false);
  }

  private async pollConnectForQr(sessionId: string) {
    const result = {
      status: 'disconnected',
      qrCode: '',
      qrBase64: '',
      isMissingInstance: false,
    };

    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const connectData: any = await this.request('GET', `instance/connect/${sessionId}`);

        result.qrCode = this.findFirstString(connectData, ['code', 'qrcode', 'qr', 'qrCode']) || '';
        result.qrBase64 = this.findFirstString(connectData, ['base64', 'qrBase64', 'qrcodeBase64']) || '';

        if (this.findCountZero(connectData)) {
          result.isMissingInstance = true;
        }

        const rawState = this.findFirstString(connectData, ['state', 'status', 'connectionStatus']);
        if (rawState) {
          const s = rawState.toLowerCase();
          if (s.includes('open') || s.includes('connected') || s.includes('online')) {
            result.status = 'connected';
          } else if (s.includes('close') || s.includes('logout') || s.includes('disconnected')) {
            result.status = 'disconnected';
          }
        }

        if (result.qrCode || result.qrBase64 || result.status === 'connected' || result.isMissingInstance) {
          break;
        }
      } catch (err) {
        // ignore and retry
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    return result;
  }

  private findFirstString(obj: any, keys: string[]): string | null {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;

    if (typeof obj === 'object') {
      for (const key of keys) {
        if (typeof obj[key] === 'string') {
          return obj[key];
        }
      }

      for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          const nested = this.findFirstString(obj[k], keys);
          if (nested) return nested;
        }
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const nested = this.findFirstString(item, keys);
        if (nested) return nested;
      }
    }

    return null;
  }

  private findCountZero(obj: any): boolean {
    if (!obj) return false;
    if (typeof obj === 'object') {
      if (typeof obj.count === 'number' && obj.count === 0) {
        return true;
      }
      for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          if (this.findCountZero(obj[k])) return true;
        }
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (this.findCountZero(item)) return true;
      }
    }
    return false;
  }

  private mapStatus(status: string): QrSessionInfo['status'] {
    const s = (status || '').toLowerCase();
    if (s.includes('open') || s.includes('connected') || s.includes('online')) {
      return 'connected';
    }
    if (s.includes('connecting') || s.includes('syncing')) {
      return 'connecting';
    }
    if (s.includes('close') || s.includes('logout') || s.includes('disconnected')) {
      return 'disconnected';
    }
    return 'idle';
  }

  private normalizeJid(jid: string): string {
    if (!jid) return '';
    const trimmed = jid.trim().replace(/\s/g, '');
    if (trimmed.includes('@')) {
      const parts = trimmed.split('@');
      const local = parts[0];
      const domain = parts[1].toLowerCase();
      if (domain === 'lid') return `${local}@lid`;
      if (domain === 'g.us') return `${local}@g.us`;
      return `${local}@s.whatsapp.net`;
    }
    return `${trimmed}@s.whatsapp.net`;
  }

  private normalizePhone(phoneOrJid: string): string {
    if (!phoneOrJid) return '';
    const clean = phoneOrJid.split('@')[0];
    return clean.replace(/\D/g, '');
  }
}
