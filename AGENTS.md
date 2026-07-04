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

## Seed Data
- Admin: `admin@callcrafter.com` / `Admin123!`
- 4 Pricing Plans
- 2 AI Providers: OpenAI (gpt-5-nano), OpenRouter (openrouter/free)
- ElevenLabs API key in AiProviders collection (name: "ElevenLabs")
- Voice engine default: elevenlabs
