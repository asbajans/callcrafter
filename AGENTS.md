# CallCrafter — AI-Powered Call Center SaaS

## Architecture

```
┌───────────────────────────────────────────────┐
│              Cloudflare Tunnel                │
│  callcrafter.com.tr → host:3500               │
└─────────────────────┬─────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────┐
│  Docker Host (single box)                     │
│  ┌────────────┐  ┌────────────┐  ┌─────────┐  │
│  │  app:3000   │  │postgres:5432│  │redis:6379│ │
│  │ 3500→3000   │  │ (internal) │  │(internal)│ │
│  └────────────┘  └────────────┘  └─────────┘  │
│  ┌───────────────────────────────────────────┐│
│  │ wa-bridge (evolution-api)  :8080          ││
│  └───────────────────────────────────────────┘│
│                                               │
│  [Passivated - stopped, not deleted]          │
│  ws-server (3501), whisper-server (3502),     │
│  piper-tts (3503), edge-tts                   │
└───────────────────────────────────────────────┘
       ▲                              ▲
       │          ElevenLabs          │
       │     Conversational AI        │
       │     (cloud, $0.08/min)       │
       └──────────────────────────────┘
```

- **No Traefik** — Cloudflare Tunnel handles SSL termination + domain routing
- **Host ports**: 3500 (app)
- **Voice engine**: ElevenLabs Conversational AI (cloud) — handles STT, TTS, turn-taking, barge-in
- **Old containers**: ws-server, whisper-server, piper-tts, edge-tts — passivated (stopped, images kept for rollback)

### Stack
- **Frontend**: Next.js 15 (App Router, `output: 'standalone'`) + Tailwind 4 + next-intl (TR/EN)
- **CMS**: Payload CMS 3 (PostgreSQL adapter, Lexical editor)
- **Database**: PostgreSQL 16 (main data)
- **Cache**: Redis 7
- **AI**: OpenAI (GPT) / Anthropic (Claude) / OpenRouter / Ollama — swappable per agent via AiProviders collection (text channels only)
- **Voice Engine**: ElevenLabs Conversational AI (cloud, paid per minute) — handles STT/TTS/turn-taking natively
- **Channels**: Twilio (voice via ElevenLabs), WhatsApp, Instagram, Web Chat
- **Billing**: Stripe
- **Deployment**: Docker + Portainer stack (no Traefik) + GitHub Actions

## Services (Portainer Stack)

| Service   | Image                               | Host Port | Container Port |
|-----------|-------------------------------------|-----------|----------------|
| postgres  | postgres:16-alpine                   | —         | 5432           |
| redis     | redis:7-alpine                       | —         | 6379           |
| app       | asbajans/callcrafter                 | 3500      | 3000           |
| wa-bridge | evoapicloud/evolution-api:v2.3.7     | —         | 8080           |

_Passivated (stopped): ws-server, whisper-server, piper-tts, edge-tts_

## Key Data Flow

### Incoming Voice Call (ElevenLabs Conversational AI)
```
Twilio → ElevenLabs (via Twilio integration)
       → ElevenLabs handles: STT (Whisper), LLM, TTS, turn-taking, barge-in
       → On conversation end → POST /api/webhooks/elevenlabs
         → Find local agent by elevenlabsAgentId
         → Create conversation record in DB
         → Deduct credits (deductAICost, service: 'llm', ~1 credit/min)
```

### Admin Sync Flow
```
Admin Panel (/admin/elevenlabs) → POST /api/admin/elevenlabs
  action: 'sync' → ElevenLabsService.createAgent() / updateAgent()
                 → Stores elevenlabsAgentId on local agent
                 → Sets webhook URL for conversation events
  action: 'delete' → ElevenLabsService.deleteAgent()
                   → Clears elevenlabsAgentId from local agent
```

### Text Channels (unchanged)
```
WhatsApp/Instagram/Web → POST /api/ai/process
                       → AgentOrchestrator (LLM)
                       → Deduct credits
```

## Key Files

### ElevenLabs Integration
- **`src/lib/ElevenLabsService.ts`** — ConvAI API client: agent CRUD, voice listing, phone number import/link, outbound calls, config builder with webhook support
- **`src/app/api/admin/elevenlabs/route.ts`** — Admin API: list agents with sync status, voice list, create/update/delete ConvAI agents, webhook URL injection
- **`src/app/[locale]/admin/elevenlabs/page.tsx`** — Admin panel: agent sync table, voice selector modal, collapsible voice reference list
- **`src/app/api/webhooks/elevenlabs/route.ts`** — Webhook handler: receive conversation events, log to conversations collection, deduct credits via `deductAICost`

### Dashboard (User-Facing)
- **`src/app/[locale]/dashboard/agents/page.tsx`** — Agent form with branded voice template selector ("Doğal Türkçe Kadın", etc.), no engine details exposed
- **`src/payload/collections/Agents.ts`** — Schema: `voiceEngine` (select: elevenlabs/livekit), `elevenlabsAgentId`, `elevenlabsPhoneNumberId`, `elevenlabsVoice`, `elevenlabsLanguage`, `elevenlabsModel`, `elevenlabsTurnTimeout`; old TTS fields hidden

### Billing
- **`src/billing/creditMiddleware.ts`** — `deductAICost` adds ElevenLabs conversation duration cost (~1 credit/min)

## Payload Collections (18+)

| Collection            | Slug                    | Purpose                        |
|-----------------------|-------------------------|--------------------------------|
| Users                 | users                   | Auth + roles                   |
| Tenants               | tenants                 | Multi-tenant isolation         |
| Agents                | agents                  | AI agent config + elevenlabs fields |
| PhoneNumbers          | phone-numbers           | Phone → agent mapping          |
| ProviderConfigs       | provider-configs        | Twilio/Zadarma config          |
| SipTrunks             | sip-trunks              | Bring-your-own SIP trunk       |
| AiProviders           | ai-providers            | AI/API provider keys + models  |
| Conversations         | conversations           | Call records (voice + text)    |
| Messages              | messages                | Transcripts                    |
| TrainingDocs          | training-docs           | RAG training documents         |
| PricingPlans          | pricing-plans           | Subscription tiers             |
| Subscriptions         | subscriptions           | Tenant subscription status     |
| Payments              | payments                | Stripe records                 |
| WebhookLogs           | webhook-logs            | Incoming webhooks (incl ElevenLabs) |
| Media                 | media                   | File uploads                   |
| WhatsAppAccounts      | whatsapp-accounts       | WhatsApp Cloud API / QR Bridge |
| WhatsAppConversations | whatsapp-conversations  | WhatsApp message threads       |
| WhatsAppMessages      | whatsapp-messages       | Individual WhatsApp messages   |

## Voice Engine Templates

Defined in `src/app/[locale]/dashboard/agents/page.tsx`:

| Value                    | Label                    | Language |
|--------------------------|--------------------------|----------|
| `natural-tr-female`      | Doğal Türkçe Kadın       | TR       |
| `professional-us-female` | Profesyonel US Kadın     | EN       |
| `natural-gb-female`      | Doğal İngiliz Kadın      | EN       |

Templates are branded — users never see "ElevenLabs" or "LiveKit" in the dashboard. Engine details are admin-only.

## DB Schema Changes

All changes applied directly via Portainer exec on `192.168.0.243` (no Payload migrations for prod):

### `agents` table additions
- `voice_engine` VARCHAR DEFAULT 'elevenlabs'
- `elevenlabs_agent_id` VARCHAR
- `elevenlabs_phone_number_id` VARCHAR
- `elevenlabs_voice` VARCHAR
- `elevenlabs_language` VARCHAR DEFAULT 'tr'
- `elevenlabs_model` VARCHAR DEFAULT 'eleven_multilingual_v2'
- `elevenlabs_turn_timeout` INTEGER DEFAULT 10

### `phone_numbers` table additions
- `voice_engine` VARCHAR DEFAULT 'elevenlabs'

## Testing
```bash
npm run typecheck              # App TS check
npm run build                  # Production build
```

## Deployment

### Stack Type: File-Based (Type 2)

Portainer stack `callcrafterai` (ID: 56) is **file-based**, not Git-connected. The compose file is stored directly in Portainer at `/data/compose/56`.

**Why not Git-based?** Stack was created from an app template (`FromAppTemplate: true`), which creates Type 2 (file) stacks. Cannot be converted to Type 1 (Git) via API — would need recreate.

### GitHub Actions Auto-Deploy

Push to `master` triggers `.github/workflows/deploy.yml`:

1. Checkout code
2. Build Docker image with Docker Buildx
3. Push to Docker Hub as `asbajans/callcrafter:latest` + `:${{ github.sha }}`
4. Call webhook URL to trigger Portainer redeploy

```yaml
# .github/workflows/deploy.yml — Portainer redeploy step (simplified)
- name: Trigger Portainer redeploy (webhook)
  run: |
    RESP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
      "${{ secrets.PORTAINER_WEBHOOK_URL }}")
```

### Webhook URL

Configured in GitHub → Settings → Secrets and variables → Actions:

| Secret                  | Value                                                                    |
|-------------------------|--------------------------------------------------------------------------|
| `PORTAINER_WEBHOOK_URL` | `https://cont.asb.web.tr/api/stacks/webhooks/c4a727ef-8ea5-4504-a58c-2469595b863a` |
| `DOCKER_USERNAME`       | `asbajans`                                                               |
| `DOCKER_PASSWORD`       | _(Docker Hub token)_                                                     |

The webhook URL was previously empty — now set correctly.

### Stack Environment Variables

Set in Portainer stack env (not in compose file):

| Variable                    | Value                                                                 |
|-----------------------------|-----------------------------------------------------------------------|
| `POSTGRES_DB`               | `callcrafter_saas`                                                    |
| `POSTGRES_USER`             | `postgres`                                                            |
| `POSTGRES_PASSWORD`         | `postcall1212`                                                        |
| `DATABASE_URI`              | `postgresql://postgres:postcall1212@postgres:5432/callcrafter_saas`   |
| `PAYLOAD_SECRET`            | `callcrafter-dev-secret-key-2024`                                     |
| `REDIS_URL`                 | `redis://redis:6379`                                                  |
| `NEXT_PUBLIC_BASE_URL`      | `https://callcrafter.com.tr`                                          |
| `NEXT_PUBLIC_APP_URL`       | `https://callcrafter.com.tr`                                          |
| `INTERNAL_API_KEY`          | `callcrafter-dev-internal-key-2024`                                   |
| `ELEVENLABS_API_KEY`        | `sk_b92d9eda05e6d126b556358acac1e5e4e7372c04862180fb`                |
| `STRIPE_SECRET_KEY`         | `sk_live_...`                                                         |
| `STRIPE_PUBLISHABLE_KEY`    | `pk_live_...`                                                         |
| `WA_BRIDGE_API_KEY`         | `callcrafter-dev-wa-key`                                              |
| `WA_BRIDGE_WEBHOOK_SECRET`  | `callcrafter-dev-wa-webhook-secret`                                   |
| `WA_BRIDGE_URL`             | `http://wa-bridge:8080`                                               |
| `WHATSAPP_CONTEXT_RESET_MINUTES` | `30`                                                             |
| `WHATSAPP_AUTO_TICKET`      | `false`                                                               |

### Manual Redeploy (when webhook fails)

```bash
# 1. Stop old container
curl -s -X POST "http://192.168.0.243:9000/api/endpoints/2/docker/containers/app/stop" \
  -H "X-API-Key: ptr_yYMgVDOuGrA1zEllYc/uviu6aJpZvy2qFUdxQClM27M="

# 2. Remove old container
curl -s -X DELETE "http://192.168.0.243:9000/api/endpoints/2/docker/containers/app?force=true" \
  -H "X-API-Key: ptr_yYMgVDOuGrA1zEllYc/uviu6aJpZvy2qFUdxQClM27M="

# 3. Pull + redeploy stack (must include StackFileContent + all Env)
GET /api/stacks/56/file?endpointId=2   # get current compose content
PUT /api/stacks/56?endpointId=2         # update stack with same content + PullImage: true + all Env vars
```

**Warning:** `PUT /api/stacks/56` overwrites both compose file AND environment variables — always pass the full `Env` array. Omitting `Env` wipes all stack env vars (breaks DATABASE_URI, ELEVENLABS_API_KEY, etc.).

### Portainer API Key

`ptr_yYMgVDOuGrA1zEllYc/uviu6aJpZvy2qFUdxQClM27M=`

Host: `192.168.0.243:9000`

### Common Issues

- **Webhook URL empty / redeploy not triggered**: Check GitHub secret `PORTAINER_WEBHOOK_URL`. If missing, paste from webhook URL above.
- **Env vars wiped after PUT**: Always include full `Env` array in PUT body (30 vars).
- **App starts with empty env**: Stack env vars were cleared — re-apply via PUT with correct Env array.
- **Compose file mismatch**: `config/portainer-stack.yml` in repo is source of truth, but Portainer has its own copy. After changing compose in repo, update it in Portainer manually or via PUT API.

## WhatsApp Integration — Meta Tech Provider (BSP) Approach

### Genel Bakış

CallCrafter bir **Meta Tech Provider (Business Solution Provider)** olarak kaydolacak. Bu modelde:

- **CallCrafter** kendi Meta Business Account'u ve WhatsApp uygulamasına sahiptir
- **Müşteriler** kendi Meta Business Account'larını oluşturmaz, bizim platformumuz üzerinden onboard olur
- **Her müşteri** kendi WhatsApp Business Account'una (WABA) ve telefon numarasına sahip olur
- **Tüm mesajlaşma** bizim tek bir webhook'umuz (`/api/webhooks/whatsapp`) üzerinden akar
- **Müşteriler** sadece telefon numaralarını verir, Meta ile uğraşmaz

### Tech Provider Olma Süreci (Meta'da Yapılacaklar)

| Adım | İşlem | Süre | Detay |
|------|-------|------|-------|
| **1** | Meta Developer hesabı oluştur | 1 saat | [developers.facebook.com](https://developers.facebook.com) |
| **2** | Yeni Meta App oluştur (WhatsApp use case) | 15 dk | App Dashboard → Create App → WhatsApp |
| **3** | Business Portfolio bağla | 15 dk | App → Use Cases → WhatsApp → Business Portfolio seç |
| **4** | **Business Verification** | **1-7 gün** | [Business Verification](https://www.facebook.com/business/help/2058515294227817) — şirket belgeleri gerekli |
| **5** | **App Review** | **1-3 gün** | Video kanıt + dokümantasyon gönder |
| **6** | Tech Provider onboarding sayfasını tamamla | 30 dk | App Dashboard → Use Cases → WhatsApp → Tech Provider onboarding |
| **7** | Embedded Signup SDK'sını entegre et | 2-3 gün | Müşteri onboarding akışı |
| **8** | Canlıya geç | — | Development → Live |

### Mimari

```
┌──────────────────────────────────────────────────────────┐
│                   CallCrafter Platform                     │
│                                                           │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │  Meta App (Bizim)    │  │  Webhook (/api/webhooks/  │   │
│  │  - 1 WABA (Master)   │  │    whatsapp)              │   │
│  │  - 1 App ID          │  │  - Tüm müşteriler buraya  │   │
│  │  - 1 System User     │  │  - phoneNumberId ile ayırt│   │
│  │  - 1 Access Token    │  │  - Tenant'a yönlendir     │   │
│  └──────────┬───────────┘  └──────────────────────────┘   │
│             │                                             │
│  ┌──────────▼──────────────────────────────────────────┐  │
│  │              WhatsAppAccounts Koleksiyonu             │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│  │  │Müşteri A│ │Müşteri B│ │Müşteri C│ │Müşteri D│   │  │
│  │  │WABA: x  │ │WABA: y  │ │WABA: z  │ │WABA: w  │   │  │
│  │  │Tel: +90…│ │Tel: +90…│ │Tel: +90…│ │Tel: +90…│   │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                    Meta Graph API                          │
│  https://graph.facebook.com/v23.0/{phone-number-id}/...   │
│  Authorization: Bearer {Tek Sistem Kullanıcı Token'ı}     │
└──────────────────────────────────────────────────────────┘
```

### Anahtar Kavramlar

| Terim | Açıklama |
|-------|----------|
| **Meta Business Account** | CallCrafter'ın Meta'daki şirket hesabı (eskiden Business Manager) |
| **WABA** | WhatsApp Business Account — her müşteri için ayrı |
| **Phone Number ID** | Meta'nın numaraya verdiği ID (ör: `123456789`) |
| **System User** | CallCrafter'ın API çağrıları için kullandığı kullanıcı |
| **Access Token** | System User'a ait uzun ömürlü token (never-expires) |
| **Embedded Signup** | Müşterinin bizim panelden WABA + numara oluşturması |
| **Registration PIN** | Numara kaydı için 6 haneli PIN (varsayılan: `000000`) |

### Müşteri Onboarding Akışı (Embedded Signup)

1. Müşteri panele girer → "WhatsApp Bağla" butonuna tıklar
2. Embedded Signup açılır penceresi açılır (Meta SDK)
3. Müşteri Meta hesabına giriş yapar
4. Müşterinin işletme bilgileri alınır (Business Verification)
5. Telefon numarası girer → SMS ile doğrular
6. Meta bize **WABA ID** + **Phone Number ID** döner
7. Biz `POST /{phone-number-id}/register` ile numarayı kaydederiz (PIN: `000000`)
8. Webhook ayarlarımız otomatik gelir (müşteri ayar yapmaz)
9. Numara aktif — mesajlaşma başlar

### Önemli Meta Politikaları ve Limitler

| Konu | Detay |
|------|-------|
| **İlk limit** | Yeni WABA başına en fazla 2 telefon numarası (başlangıçta) |
| **Limit artırma** | Business Verification + Display Name onayı + Kalite skoru ile artar |
| **Maksimum numara** | Bir WABA'da talebe bağlı olarak 50+ numara |
| **Business Verification** | Zorunlu. Şirket belgeleri (vergi levhası, vb.) gerekli. 1-7 gün. |
| **App Review** | Zorunlu. Video kanıt + dokümantasyon. 1-3 gün. |
| **Development modu** | App Review öncesi 50 unique numara/gün sınırı |
| **Numara doğrulama** | SMS veya telefon çağrısı ile 6 haneli kod |
| **Display Name onayı** | Numaranın görünen adı Meta tarafından onaylanmalı |
| **Template onayı** | Proaktif mesajlar için template gerekli (24h dışı) |
| **24 saat kuralı** | Kullanıcı son mesajından itibaren 24h içinde serbest mesaj |
| **Conversation-based pricing** | Meta konuşma başına ücretlendirir (service/marketing/utility) |
| **Numara taşıma** | Müşteri başka BSP'den geliyorsa Migration API kullanılır |

### Kullanılan Graph API Endpoints

```
# Numara kaydı
POST /v23.0/{phone-number-id}/register
{
  "messaging_product": "whatsapp",
  "pin": "000000"
}

# Mesaj gönderme
POST /v23.0/{phone-number-id}/messages
Authorization: Bearer {system-user-token}
{
  "messaging_product": "whatsapp",
  "to": "{musteri-telefonu}",
  "type": "text",
  "text": { "body": "Merhaba!" }
}

# Medya URL alma
GET /v23.0/{media-id}
Authorization: Bearer {system-user-token}

# WABA bilgisi
GET /v23.0/{waba-id}
Authorization: Bearer {system-user-token}

# Numara bilgisi
GET /v23.0/{phone-number-id}?fields=id,display_phone_number,quality_rating,platform_type
Authorization: Bearer {system-user-token}
```

### Webhook Yapılandırması

**Bizim taraf (Meta'ya girilenler):**
- **Callback URL**: `{NEXT_PUBLIC_BASE_URL}/api/webhooks/whatsapp`
- **Verify Token**: CallCrafter'ın kendi belirlediği sabit token
- **Abone olunan event**: `messages`

**Müşteri tarafı:**
- Meta Developer Console'a girmesine gerek yok
- Webhook otomatik olarak bizim URL'imize gelir
- Gelen mesaj `phoneNumberId` ile hangi müşteriye ait olduğu bulunur

**Çoklu müşteri yönlendirme:**
- Tek webhook URL, tüm müşteriler için
- Mesaj payload'undaki `entry[0].changes[0].value.metadata.phone_number_id` ile hesap eşleşir
- İlgili tenant'ın AI agent'ına yönlendirilir

### QR Bridge (Evolution API) — Alternatif Bağlantı

Tech Provider süreci tamamlanana kadar geliştirme/test amaçlı kullanılabilir:

- Her müşteri kendi WhatsApp numarasını QR kod ile bağlar
- Evolution API (wa-bridge) aracılığıyla mesajlaşma
- Altyapı: Docker'da `wa-bridge` konteyneri (`evoapicloud/evolution-api:v2.3.7`)
- Sınırlamalar: WhatsApp Web protokolü, resmi API değil, rate limit yok

### Key Files

| File | Purpose |
|------|---------|
| `src/payload/collections/WhatsAppAccounts.ts` | Account schema (cloud_api/qr) |
| `src/payload/collections/WhatsAppConversations.ts` | Conversation threads per account |
| `src/payload/collections/WhatsAppMessages.ts` | Individual messages |
| `src/channels/whatsapp/WhatsAppAdapter.ts` | Meta Cloud API client |
| `src/channels/whatsapp/WhatsAppQRBridgeAdapter.ts` | Evolution API client (QR bridge) |
| `src/app/api/whatsapp/accounts/route.ts` | CRUD accounts |
| `src/app/api/whatsapp/accounts/[id]/route.ts` | Get/update/delete account |
| `src/app/api/whatsapp/accounts/[id]/qr/route.ts` | QR lifecycle |
| `src/app/api/whatsapp/accounts/[id]/register/route.ts` | Registration API (pending → active) |
| `src/app/api/whatsapp/conversations/route.ts` | CRUD conversations |
| `src/app/api/whatsapp/conversations/[id]/send/route.ts` | Send message |
| `src/app/api/whatsapp/send-new/route.ts` | Send to new contact |
| `src/app/api/webhooks/whatsapp/route.ts` | Cloud API webhook (GET verify, POST inbound) |
| `src/app/api/webhooks/whatsapp/qr/route.ts` | QR bridge webhook (POST inbound) |
| `src/app/api/webhooks/whatsapp/shared.ts` | Shared: findOrCreateConversation, processWithAI, etc. |
| `src/app/[locale]/dashboard/whatsapp/page.tsx` | WhatsApp tab with Inbox + Accounts |
| `src/app/[locale]/dashboard/whatsapp/accounts/page.tsx` | Account management UI |
| `src/app/[locale]/dashboard/whatsapp/conversations/page.tsx` | Inbox UI |

### Multi-Tenant Webhook Routing

- Tek webhook URL (`/api/webhooks/whatsapp`), tüm müşterilerin mesajları buraya gelir
- Mesaj içindeki `phoneNumberId` ile `WhatsAppAccounts` koleksiyonundan tenant bulunur
- Tenant'ın aktif AI agent'ına yönlendirilir
- Yanıt, tenant'ın kendi WABA'sı üzerinden gider

## WhatsApp Improvements (Jul 2026)

### Aşama 1 — Webhook Bilgi Kartı
- **`src/app/[locale]/dashboard/WhatsAppAccounts/page.tsx`**: Cloud API formuna webhook URL ve verify token gösteren bilgi paneli eklendi. Kopyala butonu ile kullanıcı rahatça Meta'ya yapıştırabilir. Kurulum adımları (Callback URL, Verify Token, events) panelde açıklanır.

### Aşama 2 — Multi-Account Cloud API Webhook
- **`src/app/api/webhooks/whatsapp/route.ts`**: GET handler artık verify token ile eşleşen hesabı bulur (tüm aktif hesapları dener). POST handler `phoneNumberId` ile doğru hesabı eşler, bulamazsa ilk aktif hesaba düşer.

### Aşama 3 — QR Bridge Hesap Eşleme
- **`src/app/api/webhooks/whatsapp/qr/route.ts`**: `body.instance` dışında `body.data?.instance`, `body.data?.instanceName`, `body.server_url` gibi alternatif alanları dener. Instance adı bulunamazsa base ID ile pattern match (`_recreate` suffix temizlenir).

### Aşama 4 — Legacy Env Var Temizliği
- **`docker-compose.yml`**: Kullanılmayan `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` satırları kaldırıldı. Bu değerler artık `WhatsAppAccounts` koleksiyonunda tenant bazında saklanıyor.

### Aşama 5 — Token Koruma
- **`src/app/api/whatsapp/accounts/[id]/route.ts`**: PUT handler'da `accessToken` ve `webhookVerifyToken` boş gelirse mevcut değer korunur.
- **UI**: Edit modunda access token placeholder "(değiştirilmezse aynı kalır)" olarak güncellendi.

### Aşama 6 — QR Medya Mesaj Desteği
- **`src/app/api/webhooks/whatsapp/qr/route.ts`**: Medya mesajları (image/video/audio/document/sticker) için caption veya fallback metin (`[Resim]`, `[Video]`, `[Ses]`, `[Belge]`, `[Sticker]`) kullanılır. Artık medya mesajları sessizce atlanmaz.

### Aşama 7 — Registration API (Numara Kaydı)
- **`src/channels/whatsapp/WhatsAppAdapter.ts`**: `registerNumber(pin)` metodu eklendi — Meta Registration API'yi çağırarak "pending" durumundaki numarayı kaydeder.
- **`src/app/api/whatsapp/accounts/[id]/register/route.ts`**: POST endpoint — Cloud API hesabı için Registration API çağrısı yapar. PIN parametresi alır (default: `000000`).
- **UI**: Cloud API hesaplarında "Numarayı Kaydet" butonu. Tıklandığında `/api/whatsapp/accounts/[id]/register` çağrılır, başarılı olursa toast ile bildirilir.
- **Kullanım**: Meta Developer Console'da numara "pending" durumunda kalırsa bu buton ile 1 adımda kayıt tamamlanır.

## Seed Data
- Admin: `admin@callcrafter.com` / `Admin123!`
- 4 Pricing Plans
- 2 AI Providers: OpenAI (gpt-5-nano), OpenRouter (openrouter/free)
- ElevenLabs API key in AiProviders collection (name: "ElevenLabs")
- Voice engine default: elevenlabs
