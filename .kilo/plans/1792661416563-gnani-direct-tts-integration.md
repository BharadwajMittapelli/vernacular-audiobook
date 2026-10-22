# DEV B — Gnani.ai API Integration (direct axios in ttsProvider.js)

## Context
- `synthesizeText` (server/src/services/ttsProvider.js:118) already has a Gnani path, but it delegates per-chunk to `gnaniService.js`. This sprint inlines the authenticated axios call directly into `ttsProvider.js` and introduces the new env-var names.
- Live contract (PROJECT_DOCUMENTATION.md §6 + working code): `POST https://api.vachana.ai/api/v1/tts/inference`, header `X-API-Key-ID`, JSON response `{ audio_base64, duration, timestamps }`, **max 400 chars per request** (chunking is mandatory).
- Downstream contract (audioRoutes.js:254, studioRoutes.js:197/:502, synthesisQueue.js:129): consumes `{ audioBuffer, totalDuration, alignment, source }`; `alignment` must stay sentence-level `[{sentenceIndex, text, startTime, endTime}]` (DB JSONB + ReadAlongPlayer, "schema immutable").

## Resolved decisions (user-confirmed)
1. **Env resolution:** new names with fallback to old — `GNANI_API_KEY || GNANI_API_KEY_ID`; endpoint = `GNANI_TTS_ENDPOINT` with default `https://api.vachana.ai/api/v1/tts/inference`.
2. **Auth headers:** always `X-API-Key-ID: <key>`; add `Authorization: Bearer <GNANI_ACCESS_TOKEN>` **only when** `GNANI_ACCESS_TOKEN` is set.
3. **Alignment:** extract word timestamps from response, keep existing stitch + `calculateAlignment()` normalization; returned shape unchanged.
4. **Timestamp flag:** send `return_timestamps: true` in the request body (guess — see Risks).

## Files in scope
- `server/src/services/ttsProvider.js` (refactor)
- `server/.env.example` (add 3 vars)

Do NOT touch: `gnaniService.js` (becomes unused by this path; leave in place, out of scope), routes, queues, alignmentCalculator, audioStitcher, textProcessor.

## Tasks

### 1. `server/.env.example`
Append (keep existing `GNANI_API_KEY_ID` line, note it as fallback):
```
GNANI_TTS_ENDPOINT=https://api.vachana.ai/api/v1/tts/inference
GNANI_API_KEY=your_gnani_api_key_here
GNANI_ACCESS_TOKEN=optional_bearer_token
```

### 2. `ttsProvider.js` — module-level config + axios client
- `import axios from 'axios'` at top.
- Resolve **at call time** (not module load, so tests/env reloads work):
  - `const endpoint = process.env.GNANI_TTS_ENDPOINT || 'https://api.vachana.ai/api/v1/tts/inference'`
  - `const apiKey = process.env.GNANI_API_KEY || process.env.GNANI_API_KEY_ID`
  - `const accessToken = process.env.GNANI_ACCESS_TOKEN`
- Update provider gate (currently line 121): `if (provider === 'gnani' && (process.env.GNANI_API_KEY || process.env.GNANI_API_KEY_ID))`.

### 3. `ttsProvider.js` — replace `synthesizeWithGnani` internals
Remove the dynamic `import('./gnaniService.js')`. Add a local `callGnaniApi(chunk, language, voice, speed)`:
- POST `endpoint` with body `{ text: chunk, language, voice, speed, return_timestamps: true }`.
- Headers: always `X-API-Key-ID: apiKey`, `Content-Type: application/json`, plus `Authorization: Bearer <accessToken>` only if set.
- Options: `responseType: 'json'`, `timeout: 30000`.
- **Success:** `audioBuffer = Buffer.from(data.audio_base64, 'base64')`; `duration = data.duration`; `timestamps = data.timestamps || []`. Strict validation: if `data.audio_base64` or `data.duration` is missing → throw `Error('Gnani response missing audio_base64 or duration')` so upstream `refundCredits` triggers. Reject empty buffers (`audioBuffer.length === 0`).
- **Failure classification (must preserve the saved fallback gate semantics):**
  - HTTP response (non-200): `err.httpStatus = status` → 5xx retryable, 4xx hard-fail.
  - No response (network/timeout): `err.retryableCode = error.code` (e.g. `ECONNABORTED` from the 30s timeout) → falls back to gTTS unless `TTS_FALLBACK_ENABLED=false`.
- Keep the existing per-chunk loop in `synthesizeWithGnani`: `chunkText(text)` → sequential calls → accumulate durations → offset `ts.start/ts.end` by running `timeOffset` → `stitch(...)` → `calculateAlignment(text, cumulativeTimestamps, totalDuration)`.
- Return exactly `{ audioBuffer: mergedBuffer, totalDuration, alignment, source: 'gnani' }`.
- Leave `synthesizeWithGtts`, `isRetryableTtsFailure`, `RETRYABLE_CODES`, and the fallback orchestration in `synthesizeText` untouched (they already satisfy deliverable 4's "strict errors so refundCredits triggers": thrown errors propagate to route catch blocks which refund).

### 4. Validation
1. `node --check server/src/services/ttsProvider.js` (spec-mandated syntax gate).
2. `node --check` unaffected importers sanity: none changed, skip.
3. Static check: `rg "gnaniService" server/src/services/ttsProvider.js` returns nothing; `rg "GNANI_" server/src/services/ttsProvider.js` shows the new fallback chain.
4. Behavior smoke (optional, needs real key): with `TTS_PROVIDER=gtts` server boots and `/synthesize` still works via gTTS (no module-load crash from missing new vars).

## Failure modes & edge cases
- Missing all Gnani keys → gate falls through to gTTS (today's behavior preserved).
- Missing new vars but old `GNANI_API_KEY_ID` set → Gnani path works unchanged (backward compat).
- Timeout (30s) → `ECONNABORTED` → retryable → gTTS fallback (unless disabled).
- 4xx (bad key/voice) → hard throw → route marks failed + refunds. Never silently masked.
- Malformed 200 response (no `audio_base64`/`duration`) → strict throw → refund path.

## Risks
- **`return_timestamps: true` is a guess.** If vachana rejects unknown fields, every Gnani generation 4xx-fails (hard, visible). Mitigation: single-line payload edit to remove/rename the flag; smoke-test one real request immediately after deploy.
- `gnaniService.js` becomes dead code for this path; cleanup deferred (out of scope).
- `synthesizeChunks`/`synthesizeSpeech` exports of gnaniService.js are unused elsewhere (verify with `rg "gnaniervice"` before any future deletion).
