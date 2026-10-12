# Pillar Remediation: Migration 004 + Idempotency + TTS Fallback + Limiter/CORS

Approved design: Option A (whole-text Gnani→gTTS fallback) with safety gates (`TTS_FALLBACK_ENABLED` default true; only network codes + HTTP 5xx trigger fallback; 4xx fails hard). Target file is `server/src/services/ttsProvider.js` (the `ttsService.js` named in the brief does not exist). Task 6 (`result.source`-based upload format) is MANDATORY per reviewer: without it, a fallback generation runs under `TTS_PROVIDER=gnani` yet produces MP3 bytes, and the env-compare would stamp them `.wav`/`audio/wav` — breaks iOS/Safari playback.

Scope: `/server` only. Branch: implementer works on `dev-server` (local checkout currently on `master`; reconcile before committing).

---

## Task 1 — Create `server/migrations/004_async_queue_support.sql`

Use the spec at `.kilo/plans/1791744699973-async-queue.md:58-122` verbatim, plus permission lockdown matching migration 002 (`002_ledger_deduct_refund.sql:113-124`):

- `create table if not exists public.books` (id uuid PK, user_id uuid not null, total_chapters, completed_chapters, webhook_url, status default 'pending', created_at)
- `alter table public.audio_generations add column if not exists book_id uuid references public.books(id) on delete set null` + book_id index
- `books_status_idx` partial index
- RPCs `public.get_user_balance(p_user_id uuid) returns integer`, `public.increment_book_completion(p_book_id uuid) returns json`, `public.mark_book_failed(p_book_id uuid) returns void` — exactly as planned
- **Add**: `revoke execute on function ... from public, anon, authenticated; grant execute on function ... to service_role;` for all three RPCs (same rationale as 002: PostgREST exposes PUBLIC-executable functions to the anon key)

**Apply to Supabase**: Supabase MCP is unauthorized in this session (no `SUPABASE_ACCESS_TOKEN`). Apply manually via SQL Editor or `supabase db push`/psql with `SUPABASE_DB_URL`, then verify with:
```sql
select proname from pg_proc where pronamespace='public'::regnamespace
  and proname in ('get_user_balance','increment_book_completion','mark_book_failed');
select exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relname='books' and n.nspname='public');
```

## Task 2 — Async pre-flight: handle RPC errors explicitly (`audioRoutes.js:296`)

Current: `const { data: balanceData } = await supabase.rpc('get_user_balance', ...)` — a missing/failed RPC silently yields `null ?? 0` → false 402.

Change to destructure `error` and fail loud *before* any books insert (`:310`) or placeholder/enqueue (`:329`, `:366`):
```js
const { data: balanceData, error: balanceError } = await supabase.rpc('get_user_balance', { p_user_id: userId });
if (balanceError) {
  console.error('Balance pre-check failed:', balanceError);
  return res.status(500).json({ success: false, error: 'Credit balance check failed' });
}
const availableBalance = balanceData ?? 0;
```
402 branch (`:298-305`) unchanged. Ordering already satisfies "pre-check before placeholders" — keep it.

## Task 3 — 23505 collision handlers: failed → reset & reuse; completed → cached return

### 3a. Sync (`audioRoutes.js:128-180`)
Currently polls for completed/failed; never reuses a failed row and never short-circuits a late-arriving completed row on first fetch (poll handles it, but spec wants deterministic handling). After the `23505` detection at `:128`, before entering the poll loop, fetch the existing row once (`select id, status, audio_url, audio_path, duration, alignment` by `idempotency_key`) and branch:
- `status === 'completed'` → `resolveAudioUrl(record)` → return the same 200 cached shape as the fast path (`:98-103`).
- `status === 'failed'` → reset the row: `update { status: 'processing' }` by its id; then set `generationId = record.id` and `inserted = record` and **fall through to the existing deduction block at `:190`** (reuse the failed row's id as the deduct/refund `p_ref_id` — safe because `refund_credits` matches on `(user_id, ref_id, amount, reason='synthesis')`, though see Note below).
- `status === 'processing'` → keep the existing poll loop (`:131-179`) unchanged.

Implementation shape: hoist the pre-loop fetch, wrap existing loop in the `processing` branch. Do not duplicate the deduct/synth block — reuse it by letting the `failed` branch exit the `if (insertError...)` scope with `insertError = null`, `inserted = record`, `generationId = record.id`.

**Note (do NOT silently bypass double-charge)**: the reuse path deducts with the same `p_ref_id` as the original failed attempt. `deduct_credits` has no double-deduct guard. This is acceptable because the original deduction for a `failed` row was already refunded by the error handlers (`:236`, `synthesisQueue.js:166`), so a second deduction is a legitimate re-charge, not a duplicate.

### 3b. Async (`audioRoutes.js:343-360`)
Replace the phantom-id branch (`:353-355`) — today it enqueues a `generationId` that was never inserted. Fetch `existing` by `scopedKey` selecting `id, status`; branch:
- `processing` → `queuedJobs.push({ generationId: existing.id, chapter: ch })` (current behavior, `:352`).
- `failed` → `update { status: 'processing', user_id: userId, book_id: bookId }` where `id = existing.id`, then push `{ generationId: existing.id, chapter: ch }`.
- `completed` → do **not** enqueue; count it separately (e.g. `cachedCount++`) and include `cached: cachedCount` in the 202 body (`:380-386`). The client polls `GET /api/audio/:chapterId` which already returns fresh signed URLs for completed rows.
- No row found (shouldn't happen) → `console.warn` + continue, but do not push a phantom.

Keep scoped-key format `` `${bookId}-${ch.idempotencyKey}` `` (`:327`) — already correct per spec.

## Task 4 — Runtime Gnani → gTTS fallback (`ttsProvider.js`, whole-text)

### 4a. Preserve error classification through the wrappers
- `gnaniService.js:33-40` catch: attach `err.cause = error`, `err.retryableCode = error.code` (axios codes: `ECONNABORTED`, `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`), and `err.httpStatus = error.response?.status` on the rethrown Error before `throw`.
- `ttsProvider.js:83-85` chunk wrapper: propagate — set `wrapped.retryableCode = error.retryableCode ?? error.code` and `wrapped.httpStatus = error.httpStatus` on the new `Error('Gnani chunk synthesis failed: ...')`.

### 4b. Fallback in `synthesizeText` (`ttsProvider.js:105-113`)
```js
const RETRYABLE_CODES = new Set(['ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

function isRetryableTtsFailure(err) {
  return RETRYABLE_CODES.has(err.retryableCode) || (typeof err.httpStatus === 'number' && err.httpStatus >= 500);
}

export async function synthesizeText(text, language, voice, speed = 1.0) {
  const provider = process.env.TTS_PROVIDER || 'gtts';
  if (provider === 'gnani' && process.env.GNANI_API_KEY_ID) {
    try {
      return await synthesizeWithGnani(text, language, voice, speed);
    } catch (err) {
      if (process.env.TTS_FALLBACK_ENABLED === 'false' || !isRetryableTtsFailure(err)) throw err;
      console.warn(`[TTS] Primary provider failed, falling back to gTTS: ${err.message}`);
      return await synthesizeWithGtts(text, language, voice, speed);
    }
  }
  return await synthesizeWithGtts(text, language, voice, speed);
}
```
Gates: `TTS_FALLBACK_ENABLED` unset/anything-but-`'false'` = enabled; 4xx (no `httpStatus>=500`, no network code) rethrows and generation fails hard. Fallback returns `source:'gtts'`, so callers still see a normal result; audit/upload paths unchanged.

### 4c. Document the env var
Add `TTS_FALLBACK_ENABLED=true` with a one-line comment to `server/.env.example`.

## Task 5 — Limiter sequencing + redundant CORS

### 5a. `index.js`
- Define `asyncLimiter` (keep the 2/min config from `:71-76`) and mount it **before** `app.use('/api/audio', authMiddleware)` (`:63`):
  ```js
  app.use('/api/audio/synthesize-async', asyncLimiter);
  ```
- Delete the dead post-router block at `:70-76`.
- Extend `apiLimiter.skip` (`:54`) so async is not also burned against the 5/min global bucket:
  ```js
  skip: (req) => req.path.startsWith('/api/storefront') || req.path.startsWith('/api/audio/synthesize-async'),
  ```

### 5b. `storefrontRoutes.js`
- Remove `router.use(cors({ origin: '*' }))` (`:23`) and the now-unused `import cors from 'cors'` (`:2`). Wildcard CORS for `/api/storefront` is already supplied by the app-level delegate (`index.js:26-38`) and this router is only mounted under that prefix (`index.js:68`).

## Task 6 — MANDATORY: source-based upload format (`result.source`, not env)

Both engines already return `source` (`ttsProvider.js:54` → `'gtts'`, `:101` → `'gnani'`), and the fallback at Task 4b also returns `source:'gtts'`. Replace the env-based comparison at both upload call sites so the stored extension/content-type always follows the actual bytes:

- `audioRoutes.js:219` — change `const isGtts = process.env.TTS_PROVIDER === 'gtts';` to `const format = result.source === 'gtts' ? 'mp3' : 'wav';` and pass it at `:220`: `await uploadAudio(result.audioBuffer, chapterId, format)`.
- `synthesisQueue.js:132-137` — same change: `const format = result.source === 'gtts' ? 'mp3' : 'wav'; const { audioPath, signedAudioUrl } = await uploadAudio(result.audioBuffer, chapterId, format);`

Invariant enforced: `'gtts'` source ⇒ MP3 ⇒ `.mp3` + `audio/mpeg` (FORMAT_MAP at `storageService.js:4-7`); gnani ⇒ `.wav` unless `audioAuditService` accepts the buffer regardless (`:19-25`), and `uploadAudio` defaults to WAV for unknown format (`:56`). Keep flag naming consistent with surrounding code style.

---

## Validation (run after all tasks)

1. `npm run lint` (server dir) and `node --check` on every touched file:
   `server/src/routes/audioRoutes.js`, `server/src/queues/synthesisQueue.js`, `server/src/services/ttsProvider.js`, `server/src/services/gnaniService.js`, `server/src/routes/storefrontRoutes.js`, `server/src/index.js`.
2. Migration applied check: the SQL `SELECT` verification in Task 1 returns all 3 RPCs + `books` table + `audio_generations.book_id` column.
3. Manual smoke (needs local env / service role):
   - POST `/synthesize-async` with 2 chapters → 202, DB rows `status='processing'` with `book_id` set; workers complete; `increment_book_completion` fires webhook on last.
   - Repeat identical request → 23505 branches: processing rows reused by id (no phantom), completed counted as `cached`.
   - Resubmit after forcing one row `failed` → row reset to `processing` and re-synthesized.
   - Sync: same `Idempotency-Key` twice → second returns cached 200 with fresh signed URL (`resolveAudioUrl`).
   - Fallback: with `TTS_PROVIDER=gnani` + unreachable Gnani host → console shows `[TTS] Primary provider failed, falling back to gTTS`, result 200, and DB `audio_path` ends `.mp3` (validates Task 6: format follows `result.source` even while env still says gnani). With a 4xx response (or unset `GNANI_API_KEY_ID` with provider=gnani → not even attempted) → no fallback, 502.
   - `curl -i` 3rd `/api/audio/synthesize-async` within a minute → 429 from the 2/min limiter **and** storefront embed response contains exactly one `Access-Control-Allow-Origin: *`.

## Out of scope (flagged in audit, not approved here)

- Surface non-23505 async placeholder insert errors as 500 instead of silent `continue` (`audioRoutes.js:357-359`) — recommend follow-up.
- JWT auth implementation (`auth.js` stub).

## Rollout order

Task 1 (migration applied) MUST land before deploying Tasks 2-3 code (they depend on `get_user_balance`, `books`, `book_id`, `mark_book_failed`). Tasks 4 and 6 deploy together (Task 6 is what makes the fallback's MP3 output upload-correct); Task 5 independent.
