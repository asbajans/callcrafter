# CallCrafter — AI-Powered Call Center SaaS

## Architecture

```
┌───────────────────────────────────────────────┐
│              Cloudflare Tunnel                │
│  callcrafter.com.tr → host:3500               │
│  ws.callcrafter.com.tr  → host:3501           │
└─────────────────────┬─────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────┐
│  Docker Host (single box)                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  app:3000 │  │ws:8080   │  │postgres:5432│  │
│  │ 3500→3000 │  │3501→8080 │  │ (internal)  │  │
│  └──────────┘  └─────┬─────┘  └────────────┘  │
│  ┌──────────┐  ┌─────▼──────┐  ┌────────────┐ │
│  │redis:6379│  │piper:5000  │  │whisper:9000 │ │
│  │(internal)│  │  3503→5000 │  │  3502→9000  │ │
│  └──────────┘  └────────────┘  └────────────┘ │
│  ┌───────────────────────────────────────────┐│
│  │ wa-bridge (evolution-api)  :8080          ││
│  └───────────────────────────────────────────┘│
└───────────────────────────────────────────────┘
```

- **No Traefik** — Cloudflare Tunnel handles SSL termination + domain routing
- **Host ports**: 3500 (app), 3501 (ws-server), 3502 (whisper), 3503 (piper)
- **ws-server** serves both HTTP (Twilio webhooks) and WebSocket (media streams) on port 8080
- **piper-tts**: Self-hosted TTS with `tr_TR-dfki-medium` (Turkish female) and `en_US-lessac-medium` (English) voices
- **whisper-server**: Self-hosted STT with `faster_whisper` engine

### Stack
- **Frontend**: Next.js 15 (App Router, `output: 'standalone'`) + Tailwind 4 + next-intl (TR/EN)
- **CMS**: Payload CMS 3 (PostgreSQL adapter, Lexical editor)
- **Database**: PostgreSQL 16 (main data)
- **Cache**: Redis 7
- **Media Server**: Standalone ws-server (Express + `ws` library, HTTP+WS on single port)
- **AI**: OpenAI (GPT) / Anthropic (Claude) / OpenRouter / Ollama — swappable per agent via AiProviders collection
- **TTS**: Edge TTS (Microsoft, free, no API key) / Piper (self-hosted, offline) / ElevenLabs (cloud, paid) — per-agent selectable via `ttsProvider` field
- **STT**: Whisper (self-hosted via faster-whisper)
- **Channels**: Twilio (voice), Zadarma (voice), WhatsApp, Instagram, Web Chat
- **Billing**: Stripe
- **Deployment**: Docker + Portainer stack (no Traefik) + GitHub Actions

## Services (Portainer Stack)

| Service       | Image                                     | Host Port | Container Port |
|--------------|-------------------------------------------|-----------|----------------|
| postgres      | postgres:16-alpine                         | —         | 5432           |
| redis         | redis:7-alpine                             | —         | 6379           |
| app           | asbajans/callcrafter                       | 3500      | 3000           |
| ws-server     | asbajans/callcrafter-ws                    | 3501      | 8080           |
| whisper-server| onerahmet/openai-whisper-asr-webservice    | 3502      | 9000           |
| piper-tts     | asbajans/callcrafter-piper                 | 3503      | 5000           |
| wa-bridge     | evoapicloud/evolution-api:v2.3.7           | —         | 8080           |

Internal ports (5432, 6379, internal Docker network) never conflict with host services.

## Key Data Flow

### Incoming Voice Call (self-hosted STT/TTS)
```
Twilio → POST /twilio/voice (ws-server :8080)
       → TwiML with <Stream url="wss://.../?call={CallSid}">
       → WebSocket connection (same :8080, WS attached to HTTP server)
       → Audio chunks (mulaw 8kHz, base64)
       → Buffer + silence detection
       → local Whisper STT (transcript)
       → POST /api/ai/process (app :3000, via INTERNAL_API_KEY)
         → Look up phone number → Agent → resolveProviderConfig(agent)
           → Reads ai-providers collection with overrideAccess: true
           → Auto-detects provider type from API key prefix (sk-or-v1, sk-ant-)
         → AgentOrchestrator (GPT-4o / Claude)
         → Log conversation + messages
         → Return { response, voiceId, ttsProvider }
       → Edge TTS (Microsoft, free) or Piper (local) or ElevenLabs (cloud)
         → MP3 → ffmpeg → mulaw 8kHz → Twilio audio chunks
```

### Admin Test (browser-based voice call loop)
```
Browser → GET /api/voices/tts?voice=...&text=... → Piper TTS → play audio
Browser → MediaRecorder + VAD (RMS energy threshold)
       → {speech detected} → wait 1.5s silence → POST /api/stt/transcribe → Whisper
       → POST /api/ai/test → resolveProviderConfig → AI response
       → GET /api/voices/tts → Piper TTS → play → listen loop
```

## Recent Fixes & Changes (1 July 2026)

### Edge TTS (Microsoft) Integration — Free Unlimited TTS
- **`src/ai/tts/EdgeTTS.ts`**: Custom Edge TTS implementation using Microsoft's WebSocket protocol directly (no npm dependency). Uses `ws` library already in the project.
- **`ws-server/src/edge-tts.ts`**: Same custom Edge TTS implementation for ws-server (separate file, no shared imports between projects).
- **`src/lib/voices.ts`**: Added `EDGE_TTS_VOICES` array with 14 pre-configured voices (TR/EN/DE/FR/ES). Each voice has `provider: 'edge-tts'` field.
- **`src/payload/collections/Agents.ts`**: `ttsProvider` field updated: `auto` / `edge-tts` / `piper` / `elevenlabs`. Default is `auto` (edge-tts -> piper -> elevenlabs fallback).
- **`/api/voices/tts`**: Added `edge-tts` provider path. Returns MP3 audio for browser playback. Voice ID format: `tr-TR-EmelNeural`.
- **`/api/voices/list`**: Returns Edge TTS + Piper + ElevenLabs voices. Edge TTS voices listed first. `hasEdgeTTS: true` flag always returned.
- **`ws-server/src/media-stream.ts`**: `synthesizeEdge()` function converts Edge TTS MP3 to mulaw 8kHz via ffmpeg for Twilio compatibility. Auto fallback: edge-tts -> piper.
- **Dashboard form**: TTS provider dropdown now shows 4 options. Edge TTS voices appear in dynamic dropdown when selected.
- **Dockerfile** (app): Added `ffmpeg` to alpine runner for potential audio conversion needs.
- **ws-server/Dockerfile**: Added `ffmpeg` to alpine runner for Edge TTS MP3->mulaw conversion.
- **Dependencies**: `msedge-tts` removed — custom implementation uses project's existing `ws` library.

### ElevenLabs Cloud TTS Integration (29 June 2026)
- **`AiProviders.apiKey`** field now has `access.read: () => false` to prevent REST API exposure of API keys
- Server-side reads use `overrideAccess: true` in `resolveProvider.ts` (already in place)
- `admin: { hidden: true }` already hides key from Payload admin UI

### CRITICAL: Dashboard Agents `voiceId` → `voice` Field Name Fix
- **`src/app/[locale]/dashboard/agents/page.tsx`**: All 9 references to `voiceId` renamed to `voice` to match the Payload collection field name
- Type definition, Zod schema, form defaults, select value, error display, edit prefill, voice table cell, and test button clicks all updated

### CRITICAL: `ai/process/route.ts` — `voice.providerVoiceId` Bug
- Line 190 was `voice?.providerVoiceId || ''` where `voice = agent.voice` (a text string)
- Fixed to just use `agent.voice` directly; removed unused `voiceSettings` response field

### Instagram Webhook — Now Uses `resolveProviderConfig`
- **`src/app/api/webhooks/instagram/route.ts`**: Removed hardcoded `modelMap` and env-var-based API key lookup

### WhatsApp Shared — Dead Code Cleanup
- **`src/app/api/webhooks/whatsapp/shared.ts`**: Removed unused `modelMap` constant

### ws-server — Voice ID Now Passed to TTS
- **`ws-server/src/media-stream.ts`**: `processAudio` passes `voiceId` to `generateAndSendTTS` for real calls

### ElevenLabs Cloud TTS Integration
- **`/api/voices/tts`**: Non-streaming endpoint (`POST /v1/text-to-speech/{voice_id}`), model `eleven_multilingual_v2`, format `mp3_44100_128`. Piper voice ID'leri otomatik olarak Rachel (`21m00Tcm4TlvDq8ikWAM`)'e fallback yapar.
- **`/api/voices/list`**: Piper + ElevenLabs seslerini birlikte döner. ElevenLabs API çağrısı başarısızsa `hasElevenLabs: false`.
- **`ws-server/src/media-stream.ts`**: Aynı non-streaming endpoint, `ulaw_8000` formatı ile Twilio uyumlu.
- **Per-agent `ttsProvider`**: `auto` / `elevenlabs` / `piper` seçenekleri. Admin panelde inline TTS badge ile çevrim, dashboard formda dropdown.
- **Dashboard form**: ElevenLabs seçilince `/api/voices/list`'i çağırıp sesleri çeker, loading/error states gösterir. Piper/ElevenLabs sesleri dynamic dropdown'da listelenir.
- **Admin panel**: TTS provider inline çevrimde otomatik voice değiştirmez — kullanıcı dashboard formdan ses seçer.

### Infrastructure
- **`portainer-stack.yml`** and **`docker-compose.yml`**: `PIPER_TTS_URL`, `WHISPER_SERVER_URL`, `ELEVENLABS_API_KEY` env vars added
- Piper TTS port 3503 ✅, Whisper STT port 3502 ✅

### Database Migration `20260629_000000`
- Converts `ai_providers.models` from string array to object array format
- Adds `tts_provider` column to `agents` table (enum: auto/elevenlabs/piper, default: auto)

### Self-Hosted Voice Infrastructure
- **Piper TTS**: Dockerfile in `piper-server/` with `tr_TR-dfki-medium` and `en_US-lessac-medium` models
- **Whisper STT**: `onerahmet/openai-whisper-asr-webservice:latest` with `faster_whisper`

## Current Status (1 July 2026)
- Build: ✅ `npm run build` + `npx tsc --noEmit` passes (0 errors)
- ws-server: ✅ `npx tsc --noEmit` passes
- All services: ✅ Running on server at `http://192.168.0.243:3500`
- **Edge TTS: ✅ Integrated** — Microsoft Edge Read Aloud API, no API key needed, free unlimited. Default TTS provider (auto mode: edge-tts -> piper -> elevenlabs).
- **ElevenLabs TTS: ⚠️ 402 Payment Required** — API key valid, but no credits. `elevenlabs.io` account needs credit load.
- DNS: ⏳ `callcrafter.com.tr` + `ws.callcrafter.com.tr` propagation pending

## Portainer Setup

Stack content: `config/portainer-stack.yml`

Environment variables to set in Portainer UI:

```
POSTGRES_DB=callcrafter_saas
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postcall1212*
DATABASE_URI=postgresql://postgres:postcall1212*@postgres:5432/callcrafter_saas
PAYLOAD_SECRET=<64 char random>
REDIS_URL=redis://redis:6379
INTERNAL_API_KEY=<shared secret>
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ZADARMA_API_KEY=...
ZADARMA_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
WA_BRIDGE_API_KEY=<shared with evolution-api>
WA_BRIDGE_WEBHOOK_SECRET=<for QR bridge webhooks>
WHATSAPP_CONTEXT_RESET_MINUTES=30
```

ELEVENLABS_API_KEY=sk_...  # ElevenLabs API key (cloud TTS, requires paid account credits)

### GitHub Secrets
| Secret                     | Description                          |
|----------------------------|--------------------------------------|
| `DOCKER_USERNAME`          | Docker Hub username (asbajans)       |
| `DOCKER_PASSWORD`          | Docker Hub password/token            |
| `PORTAINER_URL`            | Portainer URL                        |
| `PORTAINER_API_KEY`        | Portainer API key                    |
| `PORTAINER_STACK_NAME`     | callcrafterai                        |

### Cloudflare Tunnel Config
```
callcrafter.com.tr   → localhost:3500
ws.callcrafter.com.tr → localhost:3501
```

## Project Structure

```
CallCrafter/
├── src/
│   ├── app/
│   │   ├── (payload)/        # Payload CMS admin + REST API
│   │   │   ├── admin/        # /admin
│   │   │   └── api/          # /api/* (Payload REST)
│   │   ├── api/              # Custom routes
│   │   │   ├── ai/process/   # POST /api/ai/process (production AI)
│   │   │   ├── ai/test/      # POST /api/ai/test (test AI with auth+credits)
│   │   │   ├── stt/          # POST /api/stt/transcribe
│   │   │   ├── voices/       # GET /tts, POST /upload
│   │   │   ├── auth/         # login, register, logout, me
│   │   │   ├── calls/        # call initiation
│   │   │   ├── twilio/       # outbound TwiML
│   │   │   ├── webhooks/     # Stripe, WhatsApp, Instagram, Zadarma
│   │   │   └── whatsapp/     # WhatsApp accounts, conversations, messages, QR
│   │   ├── [locale]/         # User pages (TR/EN)
│   │   │   ├── page.tsx      # Landing
│   │   │   ├── auth/         # Login, Register
│   │   │   ├── dashboard/    # Overview, Agents, Phone, Trunk, WhatsApp, Conversations, Training, Billing, Settings, Integrations
│   │   │   └── admin/        # Super Admin: Users, Payments, Providers, System
│   │   └── lib/              # Shared utilities (api.ts, auth.ts, i18n.ts, utils.ts, resolveProvider.ts, voices.ts)
│   ├── ai/
│   │   ├── orchestrator/     # AgentOrchestrator (OpenAI/Anthropic, tool calling)
│   │   ├── stt/              # STTModule (Whisper)
│   │   ├── tts/              # ElevenLabsTTS, EdgeTTS, TTSModule
│   │   ├── rag/              # RAGPipeline (LangChain)
│   │   └── tools/            # ToolRegistry
│   ├── billing/              # creditMiddleware, StripeService
│   ├── channels/             # WhatsAppAdapter, InstagramAdapter, WebChatAdapter, UnifiedRouter
│   ├── migrations/           # Payload DB migrations
│   └── payload/collections/  # 15+ collections
├── ws-server/src/
│   ├── index.ts              # Express + WS server (both on :8080)
│   ├── twilio-webhook.ts     # TwiML → Media Streams
│   ├── websocket.ts          # Session mgmt, silence detection, turn-taking
│   ├── media-stream.ts       # STT (local Whisper) → AI → TTS (local Piper)
│   ├── zadarma-handler.ts    # Zadarma WS client + pipeline
│   └── utils.ts              # Audio helpers (mulawToWav)
├── piper-server/
│   ├── Dockerfile            # Piper + ffmpeg + Turkish/English voices
│   ├── package.json
│   └── server.js             # HTTP API for TTS
├── config/
│   └── portainer-stack.yml   # Production stack (7 services)
├── Dockerfile                # Multi-stage (deps → builder → runner)
├── docker-compose.yml        # Local dev (matches portainer-stack)
└── .github/workflows/
    ├── test.yml              # typecheck + build
    └── deploy.yml            # Docker build → push → Portainer API
```

## Payload Collections (18)

| Collection            | Slug                    | Purpose                        |
|-----------------------|-------------------------|--------------------------------|
| Users                 | users                   | Auth + roles                   |
| Tenants               | tenants                 | Multi-tenant isolation         |
| Agents                | agents                  | AI agent config                |
| VoiceConfigs          | voice-configs           | Voice DB (legacy ElevenLabs)   |
| PhoneNumbers          | phone-numbers           | Phone → agent mapping          |
| ProviderConfigs       | provider-configs        | Twilio/Zadarma config          |
| SipTrunks             | sip-trunks              | Bring-your-own SIP trunk       |
| AiProviders           | ai-providers            | AI provider API keys + models  |
| Conversations         | conversations           | Call records                   |
| Messages              | messages                | Transcripts                    |
| TrainingDocs          | training-docs           | RAG training documents         |
| PricingPlans          | pricing-plans           | Subscription tiers             |
| Subscriptions         | subscriptions           | Tenant subscription status     |
| Payments              | payments                | Stripe records                 |
| WebhookLogs           | webhook-logs            | Incoming webhooks              |
| Media                 | media                   | File uploads                   |
| WhatsAppAccounts      | whatsapp-accounts       | WhatsApp Cloud API / QR Bridge |
| WhatsAppConversations | whatsapp-conversations  | WhatsApp message threads       |
| WhatsAppMessages      | whatsapp-messages       | Individual WhatsApp messages   |

## Conventions

### Code Style
- TypeScript strict mode, ES modules, no unused locals/parameters
- `'use client'` for interactive pages, server components default
- Tailwind 4, no CSS modules, no JSDoc comments, no emoji in code

### Next.js
- Route groups: `(payload)` for CMS, `[locale]` for user pages
- User pages use `useTranslations()` for i18n
- Custom API routes in `src/app/api/`

### ws-server
- HTTP + WebSocket on same port (8080), WS attached to HTTP server
- Communicates with app via HTTP with `INTERNAL_API_KEY`
- Twilio audio: mulaw 8kHz, 20ms chunks (160 bytes)
- Edge TTS: MP3 via msedge-tts → ffmpeg → mulaw 8kHz (Twilio compatible)
- Piper TTS output: WAV with pcm_mulaw codec (8kHz, 1 channel)
- Whisper STT: POST `/asr` with `audio_file` multipart form

## Testing
```bash
npm run typecheck              # App TS check
npm run build                  # Production build
cd ws-server && npx tsc --noEmit  # ws-server TS check
```

## Seed Data
- Admin: `admin@callcrafter.com` / `Admin123!`
- 4 Pricing Plans, 12 Default Voices (Piper) + 14 Edge TTS Voices
- 2 AI Providers: OpenAI (gpt-5-nano), OpenRouter (openrouter/free)
- Default TTS provider: `auto` (Edge TTS -> Piper -> ElevenLabs fallback)
