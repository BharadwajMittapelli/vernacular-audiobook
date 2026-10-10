# eKithab Audio Pipeline — Complete Project Documentation

**Single source of truth.** All project specs, architecture, API contracts, and workflows in one file.

---

## Table of Contents

1. [Product Requirements Document (PRD)](#1-product-requirements-document-prd)
2. [Technical Document](#2-technical-document)
3. [App/Website Flow Document](#3-appwebsite-flow-document)
4. [UI/UX Design Brief](#4-uiux-design-brief)
5. [Backend Schema Document](#5-backend-schema-document)
6. [API Integrations & Specifications](#6-api-integrations--specifications)
7. [Security & Access Document](#7-security--access-document)
8. [AI Guardrails & Rule File](#8-ai-guardrails--rule-file)
9. [Feature Ticket List](#9-feature-ticket-list)
10. [Deployment & Testing Documents](#10-deployment--testing-documents)
11. [System Architecture & File Tree](#11-system-architecture--file-tree)
12. [README / Getting Started](#12-readme--getting-started)

---

## 1. Product Requirements Document (PRD)

**Project Name:** eKithab Audio (Indic Read-Along Engine)  
**Objective:** Enable eKithab creators to convert text-based vernacular guides into synchronized, code-switched Indic audiobooks using Gnani.ai, catering to Tier-2/3 Indian demographics.

**User Personas:**  
1. **The Creator:** Domain expert who writes in vernacular languages and needs an instant, high-quality audio version of their eBook to upsell.  
2. **The Consumer:** Tier-2/3 end-user who prefers listening to native speech (with UI text highlighting) over reading static PDFs on mobile.

**Core Scope (MVP):**  
- Text-to-Speech synthesis using Gnani.ai `timbre-v2.5`.  
- Support for 5 languages: Hindi, Telugu, Tamil, Kannada, Indian English (Hinglish, Tenglish).  
- Synchronized Read-Along web player (±100ms precision).  
- Credit deduction mechanism mapped to character count (1 credit = 100 characters).

**Out of Scope (MVP):**  
- User account creation (assume hardcoded or passed via JWT from eKithab).  
- PDF/DOCX native parsing (assume plain Markdown/text input).  
- Voice cloning (using pre-set Gnani personas only).

---

## 2. Technical Document

**Architecture Pattern:** Decoupled Client-Server Monorepo.

**Infrastructure (Zero-Cost Hackathon Stack):**  
- **Client:** React 18, Vite, deployed on Vercel Edge.  
- **Server:** Node.js 18+, Express.js (TypeScript), deployed on Render (Web Service).  
- **Database & Storage:** Supabase Free Tier (PostgreSQL + S3-compatible Blob Storage).  
- **AI Engine:** Gnani.ai REST/WebSocket API.

**System Boundaries:**  
- `/client` handles state, UI rendering, HTMLAudioElement playback, and renders server-supplied alignment only.  
- `/server` handles secret management, rate limiting, Supabase I/O, Gnani network requests, chunk stitching, and alignment calculation.  
- *Strict Rule:* The frontend never calls Gnani or Supabase directly. All operations route through the `/server` API.

**Data Flow:**  
Text Input → Express API → Text Sanitization & Chunking → Gnani.ai API → Audio Buffer → Supabase Storage → Express returns Public URL & Timestamps → React Player.

---

## 3. App/Website Flow Document

**Flow 1: Creator Studio (Generation)**  
1. User opens "Audio Generator" tab on a chapter.  
2. Selects Language and Voice Persona.  
3. UI calculates estimated credit cost (1 credit = 100 characters).  
4. User clicks "Generate".  
5. UI displays shimmer loading state.  
6. Upon success, audio preview renders with a "Publish to Storefront" button.

**Flow 2: Consumer Storefront (Playback)**  
1. User opens the public eBook page.  
2. Clicks "Play Audiobook".  
3. HTMLAudioElement loads the Supabase CDN URL.  
4. As audio plays, `currentTime` triggers state updates.  
5. Text viewer auto-scrolls and highlights the exact sentence currently being spoken.  
6. User clicks a paragraph; audio seeks to that exact timestamp.

---

## 4. UI/UX Design Brief

**Design System:** Tailwind CSS + Shadcn/UI + Lucide React Icons.  
**Theme Strategy:** Minimalist, content-first. Default to eKithab's existing palette.

**Core Components:**  
- **AudioConfigModal:** Glassmorphism overlay (`bg-background/80 backdrop-blur-sm`). Use Shadcn Select, Slider, and Button components.  
- **ReadAlongPlayer:**  
  - Inactive Text: `text-muted-foreground`.  
  - Active Spoken Text: `text-primary font-bold bg-primary/10 rounded-sm px-1`.  
- **PlaybackControls:** Minimalist pill-shaped floating action bar containing Play/Pause, 15s Rewind, and Speed (1x, 1.5x, 2x) buttons controlling `HTMLAudioElement.playbackRate`.

**Accessibility (a11y):**  
- All interactive elements must be keyboard navigable (`tabIndex={0}`).  
- Contrast ratio minimum 4.5:1 for active text highlights.

---

## 5. Backend Schema Document

**Database:** Supabase PostgreSQL.

**Table 1: users** (Mocked for MVP)  
- `id` (UUID, PK) - eKithab user ID  
- `email` (String, Unique) - User email  
- `credits` (Integer) - Balance for audio generation (Default: 500)

**Table 2: audio_generations**  
- `id` (UUID, PK) - Unique generation ID  
- `user_id` (UUID, FK) - Creator ID  
- `chapter_id` (String, Index) - Reference to eKithab chapter  
- `language` (String) - e.g., 'hi-IN'  
- `audio_url` (String) - Supabase public bucket URL  
- `duration` (Float) - Total audio duration in seconds  
- `credits_used` (Integer) - Cost of this generation  
- `alignment` (JSONB) - Sentence-level timestamps `[{ sentenceIndex, text, startTime, endTime }]`  
- `idempotency_key` (UUID, Unique) - Client-provided key for deduplication  
- `status` (Enum) - 'pending' | 'completed' | 'failed'  
- `created_at` (Timestamp) - Generation timestamp

**Table 3: credit_transactions**  
- `id` (UUID, PK) - Transaction ID  
- `user_id` (UUID, FK) - User ID  
- `amount` (Integer) - Credits deducted (negative) or refunded (positive)  
- `reason` (String) - 'generation' | 'refund' | 'adjustment'  
- `ref_id` (UUID) - Reference to audio_generations.id  
- `created_at` (Timestamp) - Transaction timestamp

---

## 6. API Integrations & Specifications

**External Integration: Gnani.ai Timbre v2.5**  
- **Endpoint:** `POST https://api.vachana.ai/api/v1/tts/inference`  
- **Headers:** `X-API-Key-ID: <GNANI_KEY>`, `Content-Type: application/json`  
- **Payload Constraints:** Maximum 500 characters per request. (Express must chunk longer texts).

**Internal API: POST /api/audio/synthesize**  
- **Request Payload:** `{ chapterId, text, language, voiceProfile }`  
- **Response Payload:** `{ success, audioUrl, durationSeconds, alignment: [{ sentenceIndex, text, startTime, endTime }] }`
- **Idempotency:** Require `Idempotency-Key` header (client-generated UUID v4). Duplicate key returns existing record without re-processing.
- **Speed:** Synthesis always runs at 1.0x. Playback speed is controlled client-side via `HTMLAudioElement.playbackRate`.

**Internal API: GET /api/audio/:chapterId**  
- **Response Payload:** `{ success, audioUrl, durationSeconds, alignment: [{ sentenceIndex, text, startTime, endTime }] }`  
- **Errors:** 404 if chapter not found.

**Internal API: GET /api/credits**  
- **Headers:** `Authorization: Bearer <eKithab-JWT>`  
- **Response Payload:** `{ balance: number }`

*Strict Rule:* This schema is immutable. The frontend must rely entirely on the `alignment` array to render UI highlights. Do not calculate UI timestamps on the client.

---

## 7. Security & Access Document

**Threat Models & Mitigations:**  
1. **API Key Leakage:** Gnani.ai and Supabase Service Role keys MUST remain in `/server/.env`. The Vite frontend is prohibited from holding these keys.  
2. **Wallet Draining (DDoS):** Prevent malicious users from spamming the TTS endpoint. Apply `express-rate-limit` (Max 5 requests/min per IP).  
3. **Credit Bypassing:** The credit deduction must be atomic in a single SQL statement:
   ```sql
   UPDATE users 
   SET credits = credits - $cost 
   WHERE id = $uid AND credits >= $cost 
   RETURNING credits;
   ```
   If row count = 0, reject with HTTP 402. No separate check-then-deduct.
4. **CORS:** Express server must restrict `Access-Control-Allow-Origin` strictly to the deployed Vercel frontend URL.  
5. **Auth:** Every `/api/audio/*` request requires `Authorization: Bearer <eKithab-JWT>`. Middleware verifies signature and attaches `req.user.id`.  
6. **Idempotency:** `POST /api/audio/synthesize` requires `Idempotency-Key` header. Duplicate keys return existing `audio_generations` row (status check) without re-processing.

**Error Boundaries:**  
- Gnani 5xx errors must return HTTP 502 (Bad Gateway) to the client. Do not crash the Node process.  
- Frontend must wrap `ReadAlongPlayer` in a React Error Boundary to prevent white-screens if timestamp parsing fails.

---

## 8. AI Guardrails & Rule File

**Text Processing Strict Directives:**  
1. **Chunking Hard Limit:** Gnani fails on massive payloads. The backend MUST split text at punctuation marks into chunks strictly < 400 characters.  
2. **Markdown Stripping:** The processor must run a regex strip (`text.replace(/[#*`_\[\]]/g, '')`) before transmission to prevent the AI from reading literal asterisks or code formatting.  
3. **Code-Switching Context:** For `en-IN` (Hinglish), the text parser should rely on the Gnani Timbre model's inherent phonetic processing. Do not inject SSML phonemes manually unless testing proves a consistent failure.  
4. **Alignment Drift Mitigation:** If Gnani returns audio shorter than calculated by the heuristics, the backend must normalize the `endTime` of the final sentence to match the true buffer duration so the UI doesn't lock up.  
5. **Terminal Seek Behavior:** If `currentTime > lastSentence.endTime`, clamp to `lastSentence.endTime` and pause.

**Precedence Rules (when docs conflict):**  
- `security.md` > `README.md`  
- `api.md` > `TechnicalDocument.md`  
- `guardrails.md` > all implementation docs

---

## 9. Feature Ticket List

**Sprint 1: Core Pipeline**  
- [SERVER-01] Setup Node/Express + CORS + Supabase SDK.  
- [SERVER-02] Build `gnaniService.ts` to hit `timbre-v2.5` with hardcoded text.  
- [SERVER-03] Build `storageService.ts` to upload audio buffers to Supabase.  
- [CLIENT-01] Scaffold Vite/React app + Tailwind + Shadcn.  
- [CLIENT-02] Build `AudioConfigModal` UI.

**Sprint 2: The Sync Engine**  
- [SERVER-04] Build `textProcessor.ts` (Markdown stripping + array chunking).  
- [SERVER-05] Build Alignment Calculator (`alignmentCalculator.ts`).  
- [CLIENT-03] Build `useAudioPlayer.ts` hook to manage `currentTime`.  
- [CLIENT-04] Build `TranscriptHighlighter.tsx` component.

**Sprint 3: Polish & Edge Cases**  
- [SERVER-06] Implement Supabase Postgres Credit Deduction.  
- [CLIENT-05] Add Shimmer loading states and Error Toasts.  
- [CLIENT-06] Build public Storefront Player layout.

---

## 10. Deployment & Testing Documents

**Deployment Architecture:**  
- **Backend (Render):** Connect GitHub repo → Select `/server` → Build command: `npm run build` → Start command: `node dist/index.js`. Add ENV variables to Render dashboard.  
- **Frontend (Vercel):** Connect GitHub repo → Select `/client` → Preset: Vite. Add `VITE_API_URL` pointing to Render endpoint.

**Testing Protocol (Validation Gates — must pass before merge):**

| Gate | Command / Check | Pass Criteria |
|------|-----------------|---------------|
| **4.1 Lint & Typecheck** | `npm run lint && npm run typecheck` (both workspaces) | Zero errors |
| **4.2 Unit Test: textProcessor** | `npm test -- textProcessor` | Strips markdown; all chunks < 400 chars |
| **4.3 Integration Test: synthesize** | `POST /api/audio/synthesize` with 500-word payload | HTTP 200; valid Supabase URL; `alignment.length === sentenceCount`; `alignment[last].endTime === durationSeconds ± 0.1s` |
| **4.4 UI Test: highlight sync** | Playwright: click sentence N → `audio.currentTime` within ±100ms of `alignment[N].startTime` | All 10 random sentences pass |
| **4.5 Idempotency Test** | Same `Idempotency-Key` POST twice to `/api/audio/synthesize` | Second response = first response (no double charge, no double audio) |
| **4.6 Credit Atomicity Test** | Concurrent 5 requests from same user with 4 credits | Exactly 4 succeed, 1 returns 402; final balance = 0 |

**Legacy Quick Checks (for local dev):**  
1. Pass markdown with bold tags to `textProcessor.ts`. Assert output is clean and length < 400 chars.  
2. POST a 500-word payload to `/api/audio/synthesize`. Assert HTTP 200 and valid URL.  
3. Verify clicking a sentence updates `audio.currentTime`; pausing halts the highlighter immediately.

---

## 11. System Architecture & File Tree

```text
ekithab-audio-pipeline/
├── .kilo/
│   └── rules                     # Master rule file
├── client/                        # DEV A SCOPE
│   ├── src/
│   │   ├── components/
│   │   │   ├── studio/
│   │   │   │   ├── AudioConfigModal.tsx       # Voice/Language controls
│   │   │   │   └── CreditEstimateBadge.tsx    # Real-time credit counter
│   │   │   ├── player/
│   │   │   │   ├── ReadAlongPlayer.tsx           # Main synced player (consumes server alignment[])
│   │   │   │   ├── TranscriptHighlighter.tsx     # Sentence sync renderer
│   │   │   │   ├── PlaybackControls.tsx          # Play/Pause/Speed (playbackRate) toggles
│   │   │   │   └── ReadAlongPlayerErrorBoundary.tsx # Catches timestamp parse errors
│   │   │   └── storefront/
│   │   │       └── AudioStorefrontWidget.tsx  # Embedded storefront widget
│   │   ├── hooks/
│   │   │   └── useAudioPlayer.ts              # HTMLAudioElement state hook + server alignment sync
│   │   ├── services/
│   │   │   └── api.ts                         # Axios/Fetch client (synthesize, fetchAudio, fetchCredits)
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── server/                        # DEV B SCOPE
    ├── src/
    │   ├── config/
    │   │   ├── gnani.ts          # Gnani API credentials & endpoints
    │   │   └── supabase.ts       # Supabase client setup
    │   ├── services/
    │   │   ├── gnaniService.ts   # Timbre v2.5 wrapper
    │   │   ├── textProcessor.ts  # Markdown cleaner & sentence splitter
    │   │   ├── storageService.ts # Supabase bucket upload handler
    │   │   ├── audioStitcher.ts  # Concatenate chunk buffers + cumulative timestamps
    │   │   └── alignmentCalculator.ts # Build immutable alignment[] from chunks
    │   ├── middleware/
    │   │   ├── auth.ts           # Verify eKithab JWT
    │   │   └── creditGuard.ts    # Atomic credit deduction
    │   ├── routes/
    │   │   └── audioRoutes.ts    # Express route handlers
    │   └── index.ts
    └── package.json
```

---

## 12. README / Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account (free tier)
- Gnani.ai API key

### Installation

```bash
# Install all dependencies
npm run install:all
```

### Environment Setup

**Server** (`server/.env`):
```env
GNANI_API_KEY_ID=your_gnani_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3001
FRONTEND_URL=https://your-vercel-app.vercel.app
```

**Client** (`client/.env`):
```env
VITE_API_URL=https://your-render-app.onrender.com
```

### Development

```bash
# Start both client and server
npm run dev

# Or start individually
npm run dev:server  # Server on http://localhost:3001
npm run dev:client  # Client on http://localhost:5173
```

### Build

```bash
# Build both workspaces
npm run build
```

### API Contract

**POST** `/api/audio/synthesize`

Request:
```json
{
  "chapterId": "string",
  "text": "string",
  "language": "string",
  "voiceProfile": "string"
}
```

Response:
```json
{
  "success": true,
  "audioUrl": "https://supabase.com/storage/audio/xxx.mp3",
  "durationSeconds": 145.2,
  "alignment": [
    {
      "sentenceIndex": 0,
      "text": "Welcome to this guide.",
      "startTime": 0.0,
      "endTime": 2.5
    },
    {
      "sentenceIndex": 1,
      "text": "This is the second sentence.",
      "startTime": 2.5,
      "endTime": 5.8
    }
  ]
}
```

### Deployment

- **Backend**: Render Web Service (root: `/server`, build: `npm run build`, start: `node dist/index.js`)
- **Frontend**: Vercel (root: `/client`, preset: Vite)

### Security

- All API keys stored in server `.env` only
- Rate limiting: 5 requests/minute per IP
- CORS restricted to deployed frontend URL
- Atomic credit deduction on server (single UPDATE...WHERE...RETURNING)
- Auth: Bearer JWT on all `/api/audio/*` endpoints
- Idempotency: `Idempotency-Key` header on synthesize

### Workflow Notes

- **Trunk-based development**: All commits go to `master`. Feature flags for incomplete work.
- **No merge conflicts possible**: `/client` vs `/server` folders are disjoint.
- **Daily sync**: Both devs `git pull origin master` each morning.

---

**License:** Proprietary - eKithab Project  
**Last Updated:** 2026-10-10