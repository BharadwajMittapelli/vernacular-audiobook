# Ambiguity Resolution Plan — eKithab Audio Pipeline

**Goal**: Make all 12 markdown files internally consistent and complete enough for two devs (DEV A: client, DEV B: server) to work in parallel without blocking each other.

---

## Phase 0 — Preconditions (do once, before any other edits)

| Task | File(s) to edit | Decision |
|------|-----------------|----------|
| 0.1 Choose **single repo root name** | `architecturetree.md` line 5 | `ekithab-audio-pipeline/` (match README) |
| 0.2 Choose **single language stack** | `architecturetree.md`, `deployment.md`, README | TypeScript everywhere (`.ts`, `.tsx`); add `tsc` build step |
| 0.3 Choose **player element** | `architecturetree.md` line 21, `deployment.md` test protocol | `HTMLAudioElement` (not Web Audio API) — works on Tier-2/3 devices |
| 0.4 Choose **speed ownership** | `api.md` payload, `uiux.md` controls | Speed = `playbackRate` on `HTMLAudioElement` only; **synthesis always 1.0×** |
| 0.5 Choose **alignment owner** | `TechnicalDocument.md` line 12-13 | **Server returns immutable `alignment[]`; client renders read-only** |

> **Rule**: Apply Phase 0 edits atomically (one PR/commit) so later phases don't diverge again.

---

## Phase 1 — Server Contract & Data Model (DEV B scope)

| Task | File(s) | Deliverable |
|------|---------|-------------|
| 1.1 Add **GET endpoints** to API spec | `api.md` | `GET /api/audio/:chapterId` → `{ audioUrl, durationSeconds, alignment[] }`<br>`GET /api/credits` → `{ balance }` |
| 1.2 Define **chunk stitching strategy** | new `server/src/services/audioStitcher.ts` (add to tree) | Concatenate MP3 buffers in memory; compute cumulative `startTime`/`endTime`; fallback to ffmpeg if >50 MB |
| 1.3 Implement **alignment calculator** | new `server/src/services/alignmentCalculator.ts` (add to tree) | Input: ordered chunk responses with per-chunk timings → Output: single `alignment[]` with normalized final `endTime` = true buffer duration |
| 1.4 Extend **DB schema** | `backendschema.md` | Add to `audio_generations`: `alignment jsonb`, `idempotency_key uuid`, `status enum('pending','completed','failed')`<br>New table `credit_transactions(id, user_id, amount, reason, ref_id, created_at)` |
| 1.5 Define **atomic credit deduction** | `security.md` line 7, new `server/src/middleware/creditGuard.ts` | Pattern: `UPDATE users SET credits = credits - $cost WHERE id = $uid AND credits >= $cost RETURNING credits` — single statement, no separate check-then-deduct |
| 1.6 Add **auth middleware** | `architecturetree.md` (add `server/src/middleware/auth.ts`), `security.md` | Verify `Authorization: Bearer <eKithab-JWT>` → attach `req.user.id`; reject if missing/invalid |
| 1.7 Add **idempotency** to synthesize endpoint | `api.md`, `server/src/routes/audioRoutes.js` | Require `Idempotency-Key` header; store in `audio_generations.idempotency_key`; return existing record on duplicate |

---

## Phase 2 — Client Contract & Components (DEV A scope)

| Task | File(s) | Deliverable |
|------|---------|-------------|
| 2.1 Update **API service** | `client/src/services/api.ts` (rename from `.js`) | Add `fetchAudio(chapterId)`, `fetchCredits()`, `synthesize(payload, idempotencyKey)` |
| 2.2 Make **ReadAlongPlayer** consume server `alignment[]` only | `client/src/components/player/ReadAlongPlayer.tsx`, `TranscriptHighlighter.tsx` | Remove any local timestamp math; drive highlights purely from `alignment[sentenceIndex].startTime/endTime` |
| 2.3 Wire **speed control** to `playbackRate` | `client/src/components/player/PlaybackControls.tsx`, `useAudioPlayer.ts` | Slider values `[1, 1.5, 2]` → `audioEl.playbackRate = value`; no re-fetch |
| 2.4 Add **CreditEstimateBadge** integration | `client/src/components/studio/CreditEstimateBadge.tsx` | Call `fetchCredits()` on mount; show `balance` and `estimatedCost = ceil(chars/100)` |
| 2.5 Add **error boundary** around player | `client/src/components/player/ReadAlongPlayerErrorBoundary.tsx` | Catch timestamp parse errors; show friendly fallback UI (per `security.md` line 12) |

---

## Phase 3 — Cross-Cutting Docs & Guardrails (both devs read)

| Task | File(s) | Deliverable |
|------|---------|-------------|
| 3.1 Sync **TechnicalDocument.md** with Phase 0 decisions | `TechnicalDocument.md` | Remove "client handles sync calculation"; add "client renders server-supplied alignment only" |
| 3.2 Sync **architecturetree.md** with Phase 0-2 | `architecturetree.md` | Rename root; change extensions to `.ts/.tsx`; add `audioStitcher.ts`, `alignmentCalculator.ts`, `auth.ts`, `creditGuard.ts`; rename `useAudioPlayer.js` → `useAudioPlayer.ts` |
| 3.3 Sync **deployment.md** with TypeScript build | `deployment.md` | Render: `npm run build` (outputs `dist/`), start `node dist/index.js`<br>Vercel: preset Vite (auto-detects `tsconfig.json`) |
| 3.4 Add **terminal seek behavior** to guardrails | `guardrails.md` | "If `currentTime > lastSentence.endTime`, clamp to `lastSentence.endTime` and pause" |
| 3.5 Add **precedence rule** to master rules | `.kilocode/rules` (or `.kilo/rules`) | "When `security.md` and `README.md` conflict, `security.md` wins; when `api.md` and `TechnicalDocument.md` conflict, `api.md` wins" |

---

## Phase 4 — Validation Gates (must pass before merge)

| Gate | Command / Check | Pass Criteria |
|------|-----------------|---------------|
| 4.1 Lint & typecheck | `npm run lint && npm run typecheck` (both workspaces) | Zero errors |
| 4.2 Unit test: textProcessor | `npm test -- textProcessor` | Strips markdown; all chunks < 400 chars |
| 4.3 Integration test: synthesize | `POST /api/audio/synthesize` with 500-word payload | HTTP 200; valid Supabase URL; `alignment.length === sentenceCount`; `alignment[last].endTime === durationSeconds ± 0.1s` |
| 4.4 UI test: highlight sync | Playwright: click sentence N → `audio.currentTime` within ±100ms of `alignment[N].startTime` | All 10 random sentences pass |
| 4.5 Idempotency test | Same `Idempotency-Key` POST twice | Second response = first response (no double charge, no double audio) |
| 4.6 Credit atomicity test | Concurrent 5 requests from same user with 4 credits | Exactly 4 succeed, 1 returns 402; final balance = 0 |

---

## Open Questions (require your decision before Phase 1 starts)

| # | Question | Recommended Answer |
|---|----------|-------------------|
| Q1 | **Chunk stitching**: MP3 concatenation via `Buffer.concat` is lossless only if all chunks share identical encoder settings. Gnani may return varying bitrates. Accept risk or mandate ffmpeg? | **Mandate ffmpeg** (install in Render build); safer for production audio quality |
| Q2 | **Idempotency key source**: Client-generated UUID vs server-generated? | **Client-generated UUID v4** (passed in header); simpler, no extra round-trip |
| Q3 | **Credit cost base**: Raw input chars or post-strip chars? | **Post-strip chars** (what actually hits Gnani) — matches guardrails "chunk < 400 chars after strip" |
| Q4 | **Supabase bucket**: Public or signed URLs? | **Public bucket** (MVP); `audio_url` is permanent public CDN link; no expiry logic needed |

---

## Execution Order

1. **You decide Q1-Q4** (reply with choices or confirm recommendations)
2. I write finalized plan to this file
3. You call `plan_exit` → implementation agent takes over
4. Implementation order: Phase 0 → Phase 1 (DEV B) + Phase 2 (DEV A) in parallel → Phase 3 → Phase 4 gates

---

## Files This Plan Touches (final inventory)

```
.kilo/rules                    # precedence rule
architecturetree.md            # root name, stack, new service files
api.md                         # GET endpoints, idempotency, speed=1.0
backendschema.md               # alignment jsonb, idempotency_key, credit_transactions
deployment.md                  # TS build commands
guardrails.md                  # terminal seek behavior
security.md                    # atomic credit SQL, auth middleware
TechnicalDocument.md           # alignment ownership correction
client/src/services/api.ts     # new GET methods, idempotency header
client/src/components/player/* # alignment-only rendering, playbackRate
server/src/services/audioStitcher.ts       # new
server/src/services/alignmentCalculator.ts # new
server/src/middleware/auth.ts              # new
server/src/middleware/creditGuard.ts       # new
server/src/routes/audioRoutes.ts           # idempotency, auth, credit guard
```

---

**Next step**: Confirm Q1-Q4 (or override) and I'll finalize the plan.