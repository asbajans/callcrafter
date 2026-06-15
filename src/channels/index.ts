export {
  WhatsAppAdapter,
  type WhatsAppConfig,
  type WhatsAppMessage,
  type WhatsAppStatusUpdate,
  type WhatsAppWebhookPayload,
} from './whatsapp/WhatsAppAdapter';

export {
  WhatsAppQRBridgeAdapter,
  type WhatsAppQRBridgeConfig,
  type QrSessionInfo,
} from './whatsapp/WhatsAppQRBridgeAdapter';

export {
  InstagramAdapter,
  type InstagramConfig,
  type InstagramMessage,
} from './instagram/InstagramAdapter';

export { WebChatAdapter } from './web/WebChatAdapter';

export { UnifiedRouter } from './UnifiedRouter';

export type { AgentMapping } from './UnifiedRouter';
