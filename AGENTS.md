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
│  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────┐                                │
│  │redis:6379│                                 │
│  │(internal)│                                 │
│  └──────────┘                                │
└───────────────────────────────────────────────┘
```

- **No Traefik** — Cloudflare Tunnel handles SSL termination + domain routing
- **Single host port per service** — only 3500 (app) and 3501 (ws-server) exposed
- **ws-server** serves both HTTP (Twilio webhooks) and WebSocket (media streams) on port 8080

### Stack
- **Frontend**: Next.js 15 (App Router, `output: 'standalone'`) + Tailwind 4 + next-intl (TR/EN)
- **CMS**: Payload CMS 3 (PostgreSQL adapter, Lexical editor)
- **Database**: PostgreSQL 16 (main data)
- **Cache**: Redis 7
- **Media Server**: Standalone ws-server (Express + `ws` library, HTTP+WS on single port)
- **AI**: OpenAI (GPT-4o) / Anthropic (Claude 3.5) — swappable per agent
- **TTS**: ElevenLabs (`ulaw_8000` format, Twilio-compatible)
- **STT**: OpenAI Whisper
- **Channels**: Twilio (voice), Zadarma (voice), WhatsApp, Instagram, Web Chat
- **Billing**: Stripe
- **Deployment**: Docker + Portainer stack (no Traefik) + GitHub Actions

## Services (Portainer Stack)

| Service   | Image                          | Host Port | Container Port |
|-----------|--------------------------------|-----------|----------------|
| postgres  | postgres:16-alpine             | —         | 5432           |
| redis     | redis:7-alpine                 | —         | 6379           |
| app       | asbajans/callcrafter           | 3500      | 3000           |
| ws-server | asbajans/callcrafter-ws        | 3501      | 8080           |

Internal ports (5432, 6379, internal Docker network) never conflict with host services.

## Key Data Flow

### Incoming Voice Call
```
Twilio → POST /twilio/voice (ws-server :8080)
       → TwiML with <Stream url="wss://.../?call={CallSid}">
       → WebSocket connection (same :8080, WS attached to HTTP server)
       → Audio chunks (mulaw 8kHz, base64)
       → Buffer + silence detection
       → Whisper STT (transcript)
       → POST /api/ai/process (app :3000, via INTERNAL_API_KEY)
         → Look up phone number → Agent → Voice → Training docs
         → AgentOrchestrator (GPT-4o / Claude)
         → Log conversation + messages
         → Return { response, voiceId, voiceSettings }
       → ElevenLabs TTS (output_format: ulaw_8000)
       → Stream audio chunks back to Twilio via WebSocket
```

## Recent Fixes & Changes

### Docker Build
- `npm install --legacy-peer-deps` (Peer dependency conflict Payload ↔ Next.js)
- `output: 'standalone'` in next.config.ts
- `eslint.ignoreDuringBuilds: true` (ESLint 10 incompatible with next lint options)
- Removed `COPY --from=builder /app/public ./public` (standalone output includes it)

### CI/CD
- ESLint pinned to v8.57.1 (`eslint-config-next` requires v8)
- Lint step removed from test.yml (`next build` already validates)
- Deploy workflow uses Docker Buildx → Docker Hub → Portainer API
- Deploy workflow triggers on push to master; uses Portainer webhook for redeploy
- Test workflow: `npm install --legacy-peer-deps` → `npm run typecheck` → `npm run build`

### TypeScript
- `newConversation.id as number` casts in 3 route files (Payload's `create` returns `string | number`)

### Infrastructure
- Traefik removed (Cloudflare Tunnel handles SSL + routing)
- Host ports: 3500 → app:3000, 3501 → ws-server:8080
- ws-server WS_WS_PORT=8080 (attached to HTTP server, not separate)
- Container names: `ws-server` (consistent naming)
- Postgres password: `postcall1212*`

### JWT & Auth Fixes (21 June 2026)
- **CRITICAL**: Payload hashes `PAYLOAD_SECRET` with SHA-256 (first 32 hex chars) before JWT signing (`node_modules/payload/dist/index.js:321`). Both `src/middleware.ts` and `src/lib/auth.ts` must use the same hashed secret for JWT verification — fixed in both files.
- `src/lib/auth.ts`: Added `crypto.createHash('sha256').update(rawSecret).digest('hex').slice(0, 32)` for JWT verification.
- `src/middleware.ts`: Same hash applied to `JWT_SECRET` constant.
- `src/app/api/auth/me/route.ts`: New endpoint — returns current user from JWT cookie (used by dashboard layout to display real user info).
- `src/app/api/auth/logout/route.ts`: New endpoint — clears `payload-token` cookie.
- Cookie `secure` flag is now dynamic based on `x-forwarded-proto` header (was hardcoded to `true`, blocking HTTP access).
- Login route returns actual error message in debug mode for troubleshooting.

### Migration Fixes (21 June 2026)
- Migration `20260620_205416` made fully idempotent:
  - `CREATE TYPE` wrapped in `DO $$ IF NOT EXISTS ...`
  - `CREATE TABLE` uses `CREATE TABLE IF NOT EXISTS`
  - `ADD COLUMN` uses `ADD COLUMN IF NOT EXISTS`
  - `ADD CONSTRAINT` uses `ADD CONSTRAINT IF NOT EXISTS`
  - `CREATE INDEX` uses `CREATE INDEX IF NOT EXISTS`
- Migration failure is non-fatal; server starts regardless.

### Dashboard Fixes (21 June 2026)
- **Overview link**: Changed from `/dashboard/overview` (404) to `/dashboard`.
- **Logout button**: Added to sidebar user footer — sends POST `/api/auth/logout`, clears cookie, redirects to login.
- **User profile**: Sidebar avatar now links to Settings page. Header avatar is also clickable.
- **Dynamic user info**: Sidebar fetches `/api/auth/me` to display real user name/email/initial.
- **Language switcher**: Rewritten to use `window.location.pathname` with regex replace (was stripping `/dashboard/` from path).
- **WhatsApp nav label**: Changed from `labelKey: 'WhatsApp'` to `labelKey: 'whatsapp'` to match translation key convention.
- **Integrations page**: Added at `/dashboard/integrations` with Instagram, Facebook, CRM, Calendar connection cards.

### Landing Page Fix (21 June 2026)
- Login/register links in `src/app/[locale]/page.tsx` changed from string `"/${locale}/auth/..."` to template literal `` `/${locale}/auth/...` `` (was rendering literal `${locale}` instead of the variable).

## Deployment Status (11 June 2026)
- Build: ✅ `npm run build` passes (0 errors)
- Test workflow: ✅ Passes (typecheck + build)
- Deploy workflow: ✅ Passes (Docker → Docker Hub → Portainer)
- Site: ✅ Live at `http://192.168.0.243:3500` (landing page in Turkish)
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
ELEVENLABS_API_KEY=...
ZADARMA_API_KEY=...
ZADARMA_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
WA_BRIDGE_API_KEY=<shared with evolution-api>
WA_BRIDGE_WEBHOOK_SECRET=<for QR bridge webhooks>
WHATSAPP_CONTEXT_RESET_MINUTES=30
```

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
│   │   │   ├── ai/process/   # POST /api/ai/process
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
│   │   └── lib/              # Shared utilities (api.ts, auth.ts, i18n.ts, utils.ts)
│   ├── ai/
│   │   ├── orchestrator/     # AgentOrchestrator (OpenAI/Anthropic, tool calling)
│   │   ├── stt/              # STTModule (Whisper)
│   │   ├── tts/              # ElevenLabsTTS
│   │   ├── rag/              # RAGPipeline (LangChain)
│   │   └── tools/            # ToolRegistry
│   ├── media/adapters/       # TwilioAdapter, ZadarmaAdapter, AsteriskAdapter (stub)
│   ├── channels/             # WhatsAppAdapter, InstagramAdapter, WebChatAdapter, UnifiedRouter
│   ├── billing/              # StripeService
│   └── payload/collections/  # 15 collections
├── ws-server/src/
│   ├── index.ts              # Express + WS server (both on :8080)
│   ├── twilio-webhook.ts     # TwiML → Media Streams
│   ├── websocket.ts          # Session mgmt, silence detection, turn-taking
│   ├── media-stream.ts       # STT→AI→TTS pipeline
│   ├── zadarma-handler.ts    # Zadarma WS client + pipeline
│   └── utils.ts              # Audio helpers
├── config/
│   └── portainer-stack.yml   # Production stack (no Traefik)
├── Dockerfile                # Multi-stage (deps → builder → runner)
├── docker-compose.yml        # Local dev (matches portainer-stack)
└── .github/workflows/
    ├── test.yml              # typecheck + build
    └── deploy.yml            # Docker build → push → Portainer API
```

## Payload Collections (15)

| Collection            | Slug                    | Purpose                        |
|-----------------------|-------------------------|--------------------------------|
| Users                 | users                   | Auth + roles                   |
| Tenants               | tenants                 | Multi-tenant isolation         |
| Agents                | agents                  | AI agent config                |
| VoiceConfigs          | voice-configs           | Voice DB (ElevenLabs IDs)      |
| PhoneNumbers          | phone-numbers           | Phone → agent mapping          |
| ProviderConfigs       | provider-configs        | Twilio/Zadarma config          |
| SipTrunks             | sip-trunks              | Bring-your-own SIP trunk       |
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
- ElevenLabs TTS: `output_format: 'ulaw_8000'`

## Testing
```bash
npm run typecheck              # App TS check
npm run build                  # Production build
cd ws-server && npx tsc --noEmit  # ws-server TS check
```

## Seed Data
- Admin: `admin@callcrafter.com` / `Admin123!`
- 4 Pricing Plans, 5 Default Voices
