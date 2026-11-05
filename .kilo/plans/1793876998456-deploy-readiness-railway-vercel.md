# Deployment Readiness Plan — Railway (backend) + Vercel (frontend)

**Strict protocol:** No changes to backend request flow, route contracts, credit semantics, TTS pipeline, or DB schema. All remediations are config, scripts, dead-code removal, and one deprecated-API alias swap matching an existing in-repo pattern. Verified live against production Supabase `sgpkxgwnxusjagjnesir` on 2026-11-05.

## Verified launch blockers

| # | Issue | Location | Impact if deployed as-is |
|---|-------|----------|--------------------------|
| B1 | Dev override swallows `INSUFFICIENT_CREDITS` and returns `{ success: true, remaining: 99999 }` (the `throw` is commented out) | `server/src/services/creditService.js:34-37` | **Revenue leak**: 0-credit users synthesize free audio in prod; bulk-break, 402 paths, and refund guards become dead code. |
| B2 | `npm run build` (root) runs `--workspaces`; `server/package.json` has **no `build` script** → hard fail | `package.json:14`, `server/package.json` | Blocks any build validation and Vercel root-level install. |
| B3 | README/Railway start command says `node dist/index.js`; no build step exists | `README.md:140` | Backend crash-loops on deploy. |
| B4 | No `vercel.json` | `client/` | SPA deep-link refreshes (e.g. `/library`) 404 on Vercel. |
| B5 | No Railway config in repo | repo root | Platform guesses build/start against the workspace root; breaks. |
| B6 | `.saveToStream()` on merged-MP3 export (deprecated alias) | `server/src/routes/studioRoutes.js:661` | Express response can hang behind a reverse proxy → failed exports, wedged request slots. Project decision `ffmpeg.output_streaming` mandates `.pipe(res, { end: true })` (already used at `studioRoutes.js:223`). |
| B7 | Uncommitted local work: staged `DownloadsView.jsx`+`Dashboard.jsx`, unstaged `AudioLibrary.jsx`, untracked `test.mp3` | working tree | Cannot cut a deploy ref; risk of shipping half-reconciled conflict-resolution state from the 8f23146 merge. |
| B8 | Groq model defaults unverified for the production key (history: two models were retired mid-project) | `transcriptNormalizer.js:5`, `llmDirector.js:5`, `genreClassifier.js:6` | Silent quality degradation: director falls back to `<speak>` passthrough, classifier to "General Narrative"; Indic normalization hard-fails 502. |

## Confirmed NOT at risk (verified live, do not re-do)

- Supabase schema: all 8 tables (`users, books, chapters, audio_generations, credit_transactions, downloads, favorites, playback_history`) exist.
- All columns from migrations 001–014 present: `chapters.raw_text/normalized/normalized_words/language`, `books.language/audio_profile/webhook_url`, `audio_generations.audio_path/chapter_uuid/idempotency_key/book_id/credits_used`.
- All 5 RPCs deployed: `deduct_credits, refund_credits, get_user_balance, increment_book_completion, mark_book_failed`.
- Unique constraint `audio_generations_idempotency_key_key` present (idempotency race logic works).
- `app.set('trust proxy', 1)` present (`index.js:38`) — rate limiting works behind Railway.
- `/health` endpoint exists and is rate-limit-skipped (`index.js:90-92`).
- `pdfjs-dist` hoists into root `node_modules` via workspace install — `buildPdfBaseUrl()` resolves.
- CORS delegate + storefront wildcard exception correct (`index.js:43-55`).
- `isCreditBypassed()` is inert in production (`NODE_ENV !== 'production'` guard) — leave as is.

---

## Phase 0 — Reconcile working tree

1. Review `git diff` of the three modified files; confirm they are the intended per-chapter-download / DownloadsView / Dashboard fixes from the last session.
2. Commit them in one commit. Delete `test.mp3` (scratch artifact).
3. `npm run build:client` passes before committing.

**Validation:** `git status` clean; `git log -1` shows the commit.
**Rollback:** revert commit; nothing deployed yet.

## Phase 1 — Repo config + minimal code fixes (single PR)

1. **B1** — `creditService.js`: delete the `return { success: true, remaining: 99999 };` line and the `// DEV OVERRIDE FOR TESTING` comment; uncomment `throw new InsufficientCreditsError();`. Nothing else in the file changes.
2. **B6** — `studioRoutes.js:661`: replace `.saveToStream(res, { end: true })` with `.pipe(res, { end: true })` (exact form already proven at line 223).
3. **B2** — `server/package.json`: add `"build": "echo 'no build step (plain ESM)'"`. Root `npm run build` then succeeds; local `npm run dev` behavior unchanged.
4. **B5** — new `railway.json` at repo root:
   ```json
   {
     "$schema": "https://railway.com/railway.schema.json",
     "build": { "builder": "RAILPACK", "buildCommand": "npm install" },
     "deploy": {
       "startCommand": "npm start --workspace server",
       "healthcheckPath": "/health",
       "healthcheckTimeout": 300,
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 5
     }
   }
   ```
5. **B4** — new `client/vercel.json`:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
6. **B3** — `README.md` Deployment section: start command `npm start --workspace server` (Railway); remove `dist/index.js` reference; document both env var tables.

**Explicitly out of scope (documented debts, no prod impact at single-instance launch):** BullMQ/Redis (keep `REDIS_URL` unset → in-memory queue), InMemoryQueue durability across redeploys, rate-limiter memory store, bulk-synthesize in-memory worker, GTTS scraping fallback.

**Validation (local, before push):**
- `npm run build` at root exits 0.
- `node server/src/index.js` boots with prod-shaped env (see Phase 2 values); `GET /health` → 200.
- Server log shows `[SynthesisQueue] Using in-memory fallback (no REDIS_URL)`.
- `npm test` inside `server/` — existing Groq-gating tests pass.
- **B1 targeted check:** with a local DB, call synthesize as a user with 0 credits → 402 (not 200). At minimum: `node --input-type=module -e "..."` importing `deductCredits` and asserting it throws against a zero-balance mock, or manual staging test in Phase 3.

**Rollback:** revert one PR. Schema untouched, so nothing DB-side to unwind.

## Phase 2 — Production environment variables

**Railway service (server):** copy `server/.env.example` values into Railway Variables:
- `NODE_ENV=production`, `FRONTEND_URL=https://<vercel-domain>,https://www.<vercel-domain>` (comma-separated; the one known footgun — unset CORS silently blocks every browser call).
- Secrets from the existing `server/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME`, `GNANI_API_KEY` (+ optional `GNANI_ACCESS_TOKEN`, `GNANI_TTS_ENDPOINT`), `GROQ_API_KEY`.
- **Deliberately set:** `TTS_PROVIDER=gtts` for first prod launch (zero Gnani dependency; flip after the 23-page "Keeper of the Crimson Clay" soak test).
- **Deliberately unset/empty:** `REDIS_URL` (in-memory queue), `DEV_BYPASS_CREDITS` (never in prod), `ALLOW_DEV_MOCK_USER` (never in prod).
- Railway injects `PORT`.
- **B8:** before deploy, `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"` and confirm `qwen/qwen3.8-27b` (or set `GROQ_*_MODEL` overrides).

**Vercel project (Root Directory = `client`):**
- `VITE_API_URL=https://<railway-app>.up.railway.app`, `VITE_SUPABASE_URL=https://sgpkxgwnxusjagjnesir.supabase.co`, `VITE_SUPABASE_ANON_KEY`, `VITE_FRONTEND_URL=https://<vercel-domain>`.
- Supabase Auth → URL Configuration: add the Vercel domain to Site URL + Redirect URLs.

**Rollback:** Railway env history restores the prior set; Vercel env edit history likewise. Env changes require no code redeploy.

## Phase 3 — Deployment sequence (strict order)

1. **Deploy backend** → Railway. Healthcheck must go green on `/health`.
   - `GET /health` → 200; `GET /api/voices` → 200; `GET /api/studio` without token → 401 (auth live).
   - Railway logs: no `[CORS] FRONTEND_URL is unset` warning; queue line shows in-memory fallback.
2. **Deploy frontend** → Vercel (Vite preset, root `client`, `client/vercel.json` applies).
   - Deep-link refresh test on any subroute → app renders (rewrites work).
   - Console shows no CORS errors; login flow works (Supabase JWT reaches Railway).
3. **Prod smoke test** (real account, real credits):
   - Upload a small PDF → chapters return; ingest creates book; genre classifier writes `audio_profile`.
   - Synthesize one chapter → audio plays via signed URL; `audio_generations` row `completed`; credits debited exactly `ceil(chars/100)`.
   - **B1 live check:** exhaust/zero a staging account's credits → synthesize → **402 expected**.
   - Spatial preview returns playable audio (or degrades to passthrough without error if Groq model bad).
   - Full book → `GET /api/studio/:id/export-mp3` streams end-to-end with no hang (**B6**).
4. **Soak test:** ingest `The Keeper of the Crimson Clay (1).pdf` (280 KB, in limits) end-to-end.

**Rollback:** Vercel one-click redeploy of previous prod build; Railway → redeploy previous commit (schema is forward-compatible with the prior build, so DB never rolls back).

## Phase 4 — Post-deploy hardening (follow-up; non-blocking)

- Swap `TTS_PROVIDER=gtts` → `gnani` after soak passes; watch `[TTS] Primary provider failed` warnings for a week.
- Track `[InsufficientCreditsError]`/402 rate post-B1 — first real signal of abuse or pricing misconfiguration.
- Track stuck rows: `select count(*) from audio_generations where status='processing' and created_at < now() - interval '1 hour';` — redeploy-orphaned jobs (known in-memory-queue debt).
- Later: Upstash Redis + real BullMQ worker (fixes `synthesisQueue.js:239` — BullMQ `Queue` has no `.start()`; never set `REDIS_URL` before that worker exists), `pino` structured logs, Sentry, bulk-synthesize durability.
- Supabase Storage CORS: add the Vercel origin if audio playback shows CORS errors on `<audio>` elements.

## Open questions

1. Custom domain for Vercel (affects `FRONTEND_URL` and Supabase redirect config) — plan uses placeholders.
2. Whether staging should be split from prod Groq/Supabase — assumed no staging DB; Railway Preview env suffices.
