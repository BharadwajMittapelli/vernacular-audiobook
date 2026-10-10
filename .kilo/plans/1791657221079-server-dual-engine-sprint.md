# Sprint Plan: Server Dual-Engine TTS & Storage Infrastructure

**Role:** Dev B (Backend/Server Lead)  
**Scope:** `/server` directory only  
**Target API:** `POST /api/audio/synthesize`  
**Status:** Ready for implementation

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| gTTS audio format | Upload as `.mp3` with `contentType: 'audio/mpeg'` — no conversion to WAV |
| JWT / auth | **Skip for now.** No `EKITHAB_JWT_SECRET` available. Use a hardcoded mock user ID (`00000000-0000-0000-0000-000000000001`) in place of `req.user.id`. Add `auth.js` as a stub with a `TODO` comment for later. |
| Credit deduction | **Skip for now.** No real Supabase `users` row. Skip `creditGuard` middleware entirely; add a `TODO` for when users table exists. `credits_used` is still stored in the DB record (as 0 or calculated value) for audit purposes. |

---

## Current State Assessment

### Existing Files (Already Scaffolded)
| File | Status | Notes |
|------|--------|-------|
| `src/index.js` | OK | Express + CORS + rate-limit + health check |
| `src/config/supabase.js` | **Fix** | Bucket name `audio-files` → `audiobooks` |
| `src/config/gnani.js` | **Replace** | Logic moves to `services/gnaniService.js`; delete this file |
| `src/services/textProcessor.js` | OK | Markdown strip, chunking <400 chars, credit calc |
| `src/services/storageService.js` | **Fix** | Missing `await` on `getPublicUrl()` |
| `src/services/alignmentCalculator.js` | OK | Sentence-level alignment from timestamps |
| `src/routes/audioRoutes.js` | **Rewrite** | Add idempotency, GETH handler, wire new services |
| `package.json` | **Update** | Add `gtts` |
| `.env.example` | **Update** | Add `TTS_PROVIDER`, `GTTS_FALLBACK_ENABLED` |

### Files to Create
| File | Purpose |
|------|---------|
| `src/services/gnaniService.js` | Gnani API wrapper (extracted from config/gnani.js) |
| `src/services/audioStitcher.js` | Concatenate chunk buffers + cumulative timestamps |
| `src/services/ttsProvider.js` | Dual-engine factory: routes between `gtts` and `gnani` |
| `src/middleware/auth.js` | Stub with TODO — skip JWT verification for now |
| `src/middleware/creditGuard.js` | Stub with TODO — skip credit deduction for now |

### Files to Delete
| File | Reason |
|------|--------|
| `src/config/gnani.js` | Logic relocated to `services/gnaniService.js` |

---

## Dependencies to Add to `package.json`

```json
"gtts": "^1.2.1"
```

(`jsonwebtoken` is NOT added — auth stub does not decode tokens yet.)

Run after edit: `npm install gtts --prefix server`

---

## File Structure (Target)

```
server/
├── .env.example
├── package.json
└── src/
    ├── index.js                          # No changes
    ├── config/
    │   ├── supabase.js                   # FIX: bucket = 'audiobooks'
    │   └── gnani.js                      # DELETE
    ├── middleware/
    │   ├── auth.js                       # NEW: stub, skip verification
    │   └── creditGuard.js                # NEW: stub, skip deduction
    ├── routes/
    │   └── audioRoutes.js                # MODIFY: idempotency, GET/:chapterId
    └── services/
        ├── textProcessor.js              # No changes
        ├── storageService.js             # FIX: await getPublicUrl()
        ├── alignmentCalculator.js        # No changes
        ├── gnaniService.js               # NEW: Gnani API wrapper
        ├── audioStitcher.js              # NEW: buffer concat + offset
        └── ttsProvider.js                # NEW: dual-engine factory
```

---

## Implementation Steps

### Step 1 — Fix `.env.example`

Append these lines:
```env
TTS_PROVIDER=gtts
GTTS_FALLBACK_ENABLED=true
```

(`TTS_PROVIDER=gtts` is the default for local dev so no Gnani key is needed.)

---

### Step 2 — Fix `config/supabase.js`

Change:
```js
export const AUDIO_BUCKET = 'audio-files';
```
to:
```js
export const AUDIO_BUCKET = 'audiobooks';
```

---

### Step 3 — Fix `services/storageService.js`

Add `await` before `getPublicUrl()`:
```js
const { data } = await supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
```

---

### Step 4 — Create `services/gnaniService.js`

Extract and improve from `config/gnani.js`:

**Exports:**
- `synthesizeSpeech(text, language, voice, speed)` → `{ audioBuffer: Buffer, duration: number, timestamps: [{ word, start, end }] }`
- `synthesizeChunks(chunks, language, voice)` → `{ audioBuffers[], allTimestamps[], totalDuration }`

**Key changes from old config:**
- Single call returns structured object (not raw axios response)
- Base64 decode happens inside service
- Timestamp offset accumulation happens here
- Errors throw with descriptive message (caller maps to 502)

---

### Step 5 — Create `services/audioStitcher.js`

**Exports:**
- `stitch(audioBuffers, chunkTimestamps, chunkDurations)` → `{ mergedBuffer, cumulativeTimestamps, totalDuration }`

**Logic:**
- `Buffer.concat(audioBuffers)` for merged output
- For each chunk's timestamps, add offset = sum of all previous `chunkDurations`
- Return flat `{ start, end }` array aligned to merged timebase

---

### Step 6 — Create `services/ttsProvider.js` (Dual-Engine Factory)

```js
export async function synthesizeText(text, language, voice, speed) {
  const provider = process.env.TTS_PROVIDER || 'gtts';
  if (provider === 'gnani') return synthesizeWithGnani(text, language, voice, speed);
  return synthesizeWithGtts(text, language, voice, speed);
}
```

**gTTS path:**
- Use `gtts` package to generate MP3 buffer
- Duration heuristic: `text.length * 0.06` seconds (adjustable constant)
- Split text at sentence boundaries into chunks
- Stitch with `audioStitcher`
- Generate alignment by distributing estimated duration proportionally across sentences
- Return `{ audioBuffer, totalDuration, alignment, source: 'gtts' }`

**Gnani path:**
- `gnaniService.synthesizeChunks()` → raw buffers + timestamps
- `audioStitcher.stitch()` → merged buffer + cumulative timestamps
- `alignmentCalculator.calculateAlignment()` → final alignment array
- Return `{ audioBuffer, totalDuration, alignment, source: 'gnani' }`

---

### Step 7 — Create `middleware/auth.js` (Stub)

```js
export function authMiddleware(req, res, next) {
  // TODO: implement JWT verification once EKITHAB_JWT_SECRET is available
  req.user = { id: '00000000-0000-0000-0000-000000000001' };
  next();
}
```

---

### Step 8 — Create `middleware/creditGuard.js` (Stub)

```js
export function creditGuardMiddleware(req, res, next) {
  // TODO: implement atomic credit deduction once users table exists
  req.creditsUsed = 0;
  next();
}
```

---

### Step 9 — Rewrite `routes/audioRoutes.js`

**New flow for `POST /synthesize`:**
1. Validate body fields (`chapterId`, `text`, `language`, `voiceProfile`, `speed`) → 400
2. Read `Idempotency-Key` header → 400 if missing
3. Query `audio_generations` by `idempotency_key` → return cached result if found (200)
4. Apply `creditGuard` middleware (stub, sets `creditsUsed = 0`)
5. Call `ttsProvider.synthesizeText()`
6. Upload audio via `storageService.uploadAudio(buffer, chapterId, source)` → appends `.mp3` extension for gTTS
7. Insert `audio_generations` row with `idempotency_key`, `alignment` as JSONB
8. Return `{ success, audioUrl, durationSeconds, alignment }`

**New route: `GET /:chapterId`**
1. Query `audio_generations` by `chapter_id`
2. Return 404 if not found
3. Return `{ success, audioUrl, durationSeconds, alignment }`

---

### Step 10 — Update `package.json`

Add `gtts` to dependencies.

---

### Step 11 — Update `src/index.js`

Apply middleware to router:
```js
import { authMiddleware } from './middleware/auth.js';
import { creditGuardMiddleware } from './middleware/creditGuard.js';

app.use('/api/audio', authMiddleware);
// creditGuard applied only on POST /synthesize route, not GET
app.use('/api/audio', audioRouter);
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| gTTS Windows compatibility | `gtts` uses subprocess — test early; if broken, swap to `@gtts/browser-tts` or record manually |
| gTTS duration heuristic drift | Heuristic is rough; store as-is for dev. Gnani path uses real timestamps. Client handles `null` alignment gracefully. |
| gTTS uploads as `.mp3` but client expects `.wav` | Update `storageService.uploadAudio` to accept format param; set correct `contentType` and filename extension based on source |
| Gnani 5xx during chunk processing | Per-chunk try/catch in `gnaniService`; aggregate error thrown, caught in route → 502 |
| Idempotency query without unique constraint | Add unique index on `idempotency_key` column in migration (document as required) |
| Supabase row insert fails after upload | Wrap in transaction; if DB insert fails, log warning but do not retry upload (audio already stored) |

---

## Validation Gates

After implementation:

| # | Check | Pass Criteria |
|---|-------|---------------|
| 1 | `npm run dev` | Server starts, no crash |
| 2 | `GET /health` | `{ status: "ok" }` |
| 3 | `POST /api/audio/synthesize` with `TTS_PROVIDER=gtts` | HTTP 200, valid Supabase URL, `alignment` array populated |
| 4 | `GET /api/audio/<chapterId>` | Returns same result as step 3 |
| 5 | Duplicate `Idempotency-Key` | HTTP 200 with identical response, no second DB row |
| 6 | `TTS_PROVIDER=gnani` with valid key | HTTP 200, real timestamps from Gnani |

---

## Out of Scope (Deferred)

- Real JWT verification (`auth.js` stub → full impl)
- Atomic credit deduction (`creditGuard.js` stub → full impl)
- Gnani `timbre-v2.5` WebSocket streaming mode (REST polling only for now)
- Audio format conversion (WAV ↔ MP3)
- Supabase row deletion on synthesis failure (no cleanup logic yet)
