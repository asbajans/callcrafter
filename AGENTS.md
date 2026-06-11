# CallCrafter — AI-Powered Call Center SaaS

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│                   Cloudflare Tunnel                │
│  callcrafter.com.tr → host:3500                    │
│  ws.callcrafter.com.tr  → host:3501                │
└────────┬───────────────────────────────┬───────────┘
         │                               │
┌────────▼────────┐          ┌──────────▼──────────┐
│  App (Next.js)  │          │  WS-Server (Node)   │
│  Port 3000       │          │  HTTP :8080         │
│  Payload CMS     │◄────────►│  WS   :9090         │
│  + PostgreSQL    │  HTTP    │  Twilio Media       │
└────────┬────────┘          │  Streams Handler    │
         │                   └─────────────────────┘
┌────────▼────────┐
│   PostgreSQL    │
│   + Redis       │
└─────────────────┘
```

### Stack
- **Frontend**: Next.js 15 (App Router) + Tailwind 4 + next-intl (TR/EN)
- **CMS**: Payload CMS 3 (PostgreSQL adapter, Lexical editor)
- **Database**: PostgreSQL 17 (main data) + pgvector (vector embeddings, optional)
- **Cache**: Redis 7
- **Media Server**: Standalone ws-server (Express + `ws` library)
- **AI**: OpenAI (GPT-4o) / Anthropic (Claude 3.5) — swappable per agent
- **TTS**: ElevenLabs (`ulaw_8000` format, Twilio-compatible, no conversion needed)
- **STT**: OpenAI Whisper
- **Channels**: Twilio (voice), Zadarma (voice), WhatsApp (Business API), Instagram (Meta Graph API), Web Chat
- **Billing**: Stripe
- **Deployment**: Docker + Portainer stack + GitHub Actions

## Project Structure

```
CallCrafter/
├── src/
│   ├── app/
│   │   ├── (payload)/        # Payload CMS admin + REST API
│   │   │   ├── admin/        # /admin (Payload admin panel)
│   │   │   └── api/          # /api/* (Payload REST API)
│   │   ├── api/              # Custom API routes (health, auth, calls, ai/process)
│   │   │   ├── ai/process/   # POST /api/ai/process (called by ws-server)
│   │   │   ├── auth/         # login, register
│   │   │   ├── calls/        # call initiation
│   │   │   ├── twilio/       # outbound TwiML
│   │   │   └── webhooks/     # Stripe, Twilio status
│   │   ├── [locale]/         # User-facing pages (TR/EN)
│   │   │   ├── page.tsx      # Landing page
│   │   │   ├── auth/         # Login, Register
│   │   │   ├── dashboard/    # Overview, Agents, Phone, Trunk, Conversations, Training, Billing, Settings
│   │   │   └── admin/        # Super Admin: Users, Payments, Providers, System
│   │   └── lib/              # Shared utilities
│   ├── ai/
│   │   ├── orchestrator/     # AgentOrchestrator (OpenAI/Anthropic, tool calling)
│   │   ├── stt/              # STTModule (Whisper)
│   │   ├── tts/              # ElevenLabsTTS
│   │   ├── rag/              # RAGPipeline (LangChain)
│   │   └── tools/            # ToolRegistry
│   ├── media/
│   │   ├── adapters/         # TwilioAdapter, ZadarmaAdapter, AsteriskAdapter (stub)
│   │   └── router/           # MediaRouter
│   ├── channels/             # WhatsAppAdapter, InstagramAdapter, WebChatAdapter, UnifiedRouter
│   ├── billing/              # StripeService
│   └── payload/collections/  # 15 Payload collections
├── ws-server/                # Standalone WebSocket media server
│   └── src/
│       ├── index.ts          # Express + WS server, initMediaStream
│       ├── twilio-webhook.ts # TwiML response → Media Streams
│       ├── websocket.ts      # WebSocket handler, session management, turn-taking
│       ├── media-stream.ts   # STT → AI → TTS pipeline (Whisper → API → ElevenLabs)
│       └── utils.ts          # Audio helpers (mulaw→WAV, silence detection)
├── config/cloudflared/       # Cloudflare Tunnel config
├── docker-compose.yml        # 6 services: traefik, postgres, redis, app, ws-server, pgvector
├── Dockerfile                # Multi-stage app build
└── .github/workflows/
    ├── test.yml              # CI: typecheck + lint + build (app + ws-server)
    └── deploy.yml            # CD: Docker build → push → Portainer API update
```

## Key Data Flow

### Incoming Voice Call
```
Twilio → POST /twilio/voice (ws-server HTTP :8080)
       → TwiML with <Stream url="wss://.../?call={CallSid}">
       → WebSocket connection (ws-server WS :9090)
       → Audio chunks (mulaw 8kHz, base64)
       → Buffer + silence detection
       → Whisper STT (transcript)
       → POST /api/ai/process (main app :3000)
         → Look up phone number → Agent → Voice → Training docs
         → AgentOrchestrator (GPT-4o / Claude)
         → Log conversation + messages
         → Return { response, voiceId, voiceSettings }
       → ElevenLabs TTS (output_format: ulaw_8000)
       → Stream audio chunks back to Twilio via WebSocket
```

### Outbound Voice Call
```
Dashboard → POST /api/calls { agentId, phoneNumber, tenantId }
          → POST /twilio/call (ws-server)
          → Twilio REST API (create call)
          → Same inbound flow after connection
```

## Payload Collections (15)

| Collection        | Slug              | Purpose                        |
|-------------------|-------------------|--------------------------------|
| Users             | users             | Auth + roles (super-admin, tenant-admin, user) |
| Tenants           | tenants           | Multi-tenant isolation         |
| Agents            | agents            | AI agent config (prompt, voice, model, tools) |
| VoiceConfigs      | voice-configs     | Voice database (ElevenLabs provider IDs) |
| PhoneNumbers      | phone-numbers     | Phone numbers → agent mapping  |
| ProviderConfigs   | provider-configs  | Twilio/Zadarma account configs |
| SipTrunks         | sip-trunks        | Bring-your-own SIP trunk       |
| Conversations     | conversations     | Call/conversation records      |
| Messages          | messages          | Per-message transcripts        |
| TrainingDocs      | training-docs     | RAG training documents         |
| PricingPlans      | pricing-plans     | Subscription tiers             |
| Subscriptions     | subscriptions     | Tenant subscription status     |
| Payments          | payments          | Stripe payment records         |
| WebhookLogs       | webhook-logs      | All incoming webhooks          |
| Media             | media             | File uploads (S3)              |

## Conventions

### Code Style
- **TypeScript**: strict mode, ES modules, no unused locals/parameters
- **React**: `'use client'` for interactive pages, server components default
- **CSS**: Tailwind 4 utility classes, no CSS modules
- **No JSDoc comments** unless documenting public API
- **No emoji in code** (only in console.log for dev visibility)

### Next.js
- Route groups: `(payload)` for Payload admin/API, `[locale]` for user pages
- All user pages under `[locale]` use `useTranslations()` for i18n
- API routes in `src/app/api/` are internal (not Payload)
- Payload REST API at `/api/{collection}` inside `(payload)` group

### Payload
- Access control: tenant-scoped read/write; super-admin has full access
- Depth: 2 for deep queries, 0 for shallow
- Relationships: use `relationTo` field type
- Timestamps: `timestamps: true` on Conversations

### ws-server
- Standalone Node.js ESM project (separate package.json)
- Communicates with main app via HTTP with `INTERNAL_API_KEY`
- No Payload dependency — lightweight, real-time focus
- Twilio audio: mulaw 8kHz, 20ms chunks (160 bytes)
- ElevenLabs TTS: `output_format: 'ulaw_8000'` for direct Twilio compatibility

### Media Adapter Pattern
```typescript
interface MediaAdapter {
  initiateCall(params: CallParams): Promise<CallResult>
  endCall(callSid: string): Promise<void>
  getCallStatus(callSid: string): Promise<CallStatus>
  getStreamUrl?(callSid: string): string  // optional, for WS streaming
}
```
Adapters: TwilioAdapter (complete), ZadarmaAdapter (partial), AsteriskAdapter (stub).

## Environment Variables

See `.env.example` (dev) and `.env.production.example` (prod).

Key variables:
- `INTERNAL_API_KEY` — shared secret between app and ws-server
- `OPENAI_API_KEY` — Whisper STT + GPT models
- `ANTHROPIC_API_KEY` — Claude models
- `ELEVENLABS_API_KEY` — TTS
- `TWILIO_*` — Voice provider
- `STRIPE_*` — Billing

## Deployment

### GitHub Secrets Required
| Secret                     | Description                          |
|----------------------------|--------------------------------------|
| `DOCKER_USERNAME`          | Docker Hub username                  |
| `DOCKER_PASSWORD`          | Docker Hub password/token            |
| `PORTAINER_URL`            | https://portainer.your-server.com    |
| `PORTAINER_API_KEY`        | Portainer API key                    |
| `PORTAINER_STACK_NAME`     | Stack name in Portainer              |

### Portainer Stack
The deploy workflow does NOT use `docker-compose.yml` directly. Instead:
1. Create a stack manually in Portainer (similar to docker-compose.yml)
2. Use image tags from Docker Hub (e.g., `youruser/callcrafter:latest`)
3. Workflow updates image tags via Portainer API

### One-Time Setup
```bash
# 1. Cloudflare Tunnel
ssh user@server
cloudflared tunnel create callcrafter
cloudflared tunnel route dns callcrafter callcrafter.com.tr
cloudflared tunnel route dns callcrafter ws.callcrafter.com.tr

# 2. Portainer stack
# Create stack with docker-compose content, set env vars

# 3. GitHub Secrets
# Add all secrets listed above to GitHub repo
```

## Testing
```bash
npm run typecheck    # Main app TypeScript check
npm run lint         # Next.js lint
npm run build        # Production build
cd ws-server && npx tsc --noEmit  # ws-server type check
```

## Seed Data
- Admin: `admin@callcrafter.com` / `Admin123!`
- 4 Pricing Plans: Free ($0), Starter ($49), Professional ($149), Enterprise ($499)
- 5 Default Voices: Ahmet, Rachel, Domi, Bella, Antoni
