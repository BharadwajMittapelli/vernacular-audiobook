# Phase 3 (DEV B / Server): Atomic Credit Ledger + Public Storefront Embed

**Branch:** `dev-server` · **Scope:** `/server` only · **Role:** Dev B (Backend Lead)

## Goal
Replace the mock credit stub with an atomic, race-safe credit ledger, and expose a public, CORS-open, rate-limited read-only embed endpoint for third-party storefronts.

## Resolved decisions (from review — these OVERRIDE the literal task text where they conflict)
1. **Ledger columns = doc schema (immutable `PROJECT_DOCUMENTATION.md` §5).** `credit_transactions` insert uses `reason` (value `'synthesis'`) and `ref_id`, NOT the task's `type`/`reference_id`. Using the task's names throws `PGRST204` — the same bug class fixed in migration `001`.
2. **Deduction is an atomic Postgres RPC, called ONLY by the idempotency-placeholder winner.** The task's literal placement (deduct inside `creditGuard` middleware, before the handler's idempotency fast-path at `audioRoutes.js:72-87`) double-charges on `Idempotency-Key` replay and charges losing concurrent requests. A `deduct_credits()` function does `UPDATE users ... WHERE credits >= cost RETURNING credits` + the `credit_transactions` insert in one transaction; the handler calls it only after the placeholder INSERT wins the `idempotency_key` unique constraint. Deduct still runs before `synthesizeText`, so unpaid requests never burn TTS/CPU (task outcome #3 preserved).
   - **Scope consequence:** this touches `audioRoutes.js` and adds a migration — beyond the 4 files the task named. This is required by the chosen correctness guarantee.
3. **Cost is computed on MARKDOWN-STRIPPED length**, matching the client's authoritative estimate (`CreditEstimateBadge.jsx:4-5` = `Math.ceil(stripMarkdown(text).length / 100)`). Charging raw `text.length` would bill more than the user was shown. `calculateCost(characterCount)` = `Math.ceil(characterCount/100)`; the guard passes `stripMarkdown(text).length`.

## Mandatory review corrections (applied)
4. **Refund on synthesis/upload failure (business logic).** Never charge when Gnani or storage fails. New `refund_credits()` RPC adds credits back + inserts a `reason='refund'`, `amount=+cost` ledger row; the handler calls `refundCredits()` in the synthesis/upload catch before marking the row `failed`.
5. **Storefront keyed by `generationId` (data correctness).** A `chapter_id` can have multiple generations (language/voice/reruns), so `chapter_id` is ambiguous. Route becomes `GET /api/storefront/embed/:generationId`, querying `audio_generations.id` (the unique PK). This also makes the embed URL unambiguously resolvable and lets the earlier "latest by created_at" heuristic disappear.
6. **CORS uses a per-request delegate, not `skip` and not mount order.** Verified against the `expressjs/cors` README: `cors` has NO `skip` option (that is `express-rate-limit`), and `app.use(cors(restricted))` on `app` runs for every request regardless of router mount order, so a storefront router mounted "before" it would still get the restricted `Access-Control-Allow-Origin` set. Correct fix: ONE `app.use(cors(delegate))` where the delegate returns `{ origin: '*' }` for `/api/storefront` and the restricted policy elsewhere. (Rate-limiter `skip` stays — it is valid there.)

## Files
- NEW `server/migrations/002_ledger_deduct_refund.sql` (deduct_credits + refund_credits)
- NEW `server/src/services/creditService.js` (deductCredits + refundCredits)
- REWRITE `server/src/middleware/creditGuard.js` (cost compute only)
- EDIT `server/src/routes/audioRoutes.js` (deduct post-placeholder-winner + refund on failure)
- NEW `server/src/routes/storefrontRoutes.js` (embed by generationId)
- EDIT `server/src/index.js` (CORS delegate + limiter skip + mount)

---

### 1. Migration `002_ledger_deduct_refund.sql` (idempotent, safe to re-run)
- `create extension if not exists pgcrypto;`
- `create table if not exists public.users (id uuid primary key, email text unique, credits integer not null default 500);`
- `create table if not exists public.credit_transactions (id uuid primary key default gen_random_uuid(), user_id uuid, amount integer, reason text, ref_id uuid, created_at timestamptz not null default now());` (doc §5 column names; task assumes it exists — IF NOT EXISTS is defensive only)
- Seed mock user for the current auth stub (`auth.js:7` = `00000000-0000-0000-0000-000000000001`): `insert into public.users (id, email, credits) values ('00000000-0000-0000-0000-000000000001','mock@ekithab.local',500) on conflict (id) do nothing;`
- `create or replace function public.deduct_credits(p_user_id uuid, p_cost integer, p_ref_id uuid) returns integer language plpgsql as $$ declare v integer; begin update public.users set credits = credits - p_cost where id = p_user_id and credits >= p_cost returning credits into v; if not found then raise exception 'INSUFFICIENT_CREDITS' using errcode='P0001'; end if; insert into public.credit_transactions (user_id, amount, reason, ref_id) values (p_user_id, -p_cost, 'synthesis', p_ref_id); return v; end; $$;`
- Return value = new balance. 0-row UPDATE => `INSUFFICIENT_CREDITS` exception. The UPDATE and INSERT share one function transaction => never a charge without a ledger row.
- `create or replace function public.refund_credits(p_user_id uuid, p_cost integer, p_ref_id uuid) returns integer language plpgsql as $$ declare v integer; begin update public.users set credits = credits + p_cost where id = p_user_id returning credits into v; insert into public.credit_transactions (user_id, amount, reason, ref_id) values (p_user_id, p_cost, 'refund', p_ref_id); return v; end; $$;` (adds credits back, no lower-bound guard, logs `amount=+cost`, `reason='refund'`; UPDATE+INSERT atomic in one transaction; return new balance).

### 2. `creditService.js`
- `export class InsufficientCreditsError extends Error` (`name='InsufficientCreditsError'`, `message='INSUFFICIENT_CREDITS'`).
- `export function calculateCost(characterCount) { return Math.ceil(characterCount / 100); }`
- `export async function deductCredits(userId, characterCount, referenceId)`:
  - `const cost = calculateCost(characterCount);`
  - `const { data, error } = await supabase.rpc('deduct_credits', { p_user_id: userId, p_cost: cost, p_ref_id: referenceId });`
  - if `error` and message matches `/INSUFFICIENT_CREDITS/` => throw `InsufficientCreditsError`.
  - if other `error` => throw generic Error (route maps to 500).
  - return `data` (new balance integer). Handler stores it as `req.remainingCredits`.
- `export async function refundCredits(userId, characterCount, referenceId)`:
  - `const cost = calculateCost(characterCount);`
  - `const { data, error } = await supabase.rpc('refund_credits', { p_user_id: userId, p_cost: cost, p_ref_id: referenceId });`
  - if `error` => throw Error (handler logs CRITICAL; see §4). Return `data` (new balance).

### 3. `creditGuard.js` (now synchronous, no DB)
- Stop importing `calculateCredits`; import `stripMarkdown` from `textProcessor.js` and `calculateCost` from `creditService.js`.
- `req.creditsUsed = calculateCost(stripMarkdown(text).length)` (0 if no text); `next()`.
- 402 handling MOVES OUT of this middleware to the handler (decision #2). Keep the exact 402 body from the task in the handler.

### 4. `audioRoutes.js`
- Keep `router.post('/synthesize', creditGuardMiddleware, handler)` and all Phase-2 idempotency logic UNCHANGED (fast-path `:72-87`, placeholder INSERT `:97-108`, 23505 poll branch, timeout). Fast-path and race/poll losers return WITHOUT any deduction (this is the double-charge fix).
- After the successful placeholder INSERT (`:166`, i.e. not the 23505 branch and not a generic insert error), and BEFORE `synthesizeText`, insert:
  - `let remaining; try { remaining = await deductCredits(userId, cleanText.length, generationId); } catch (err) { await supabase.from('audio_generations').update({ status:'failed' }).eq('id', inserted.id); if (err.name==='InsufficientCreditsError') return res.status(402).json({ success:false, error:'Insufficient credits. Please top up your wallet.' }); throw err; } req.remainingCredits = remaining;`
  - `generationId` (minted `:90`) is the placeholder row id, so `ref_id` correctly references `audio_generations.id`.
  - `cleanText.length` (`:89`) == the guard's stripped length => `credits_used` column (`:184`, `req.creditsUsed`) and the RPC cost stay identical.
- Import `deductCredits` (+ `InsufficientCreditsError` check by name) from `creditService.js`.
- **Refund on synthesis/upload failure (correction #4).** The existing try/catch around `synthesizeText` + `uploadAudio` (`:171-195`) is where the charge must be reversed. In its catch, BEFORE `update({status:'failed'})` and the rethrow:
  - `try { await refundCredits(userId, cleanText.length, generationId); } catch (refundErr) { console.error('CRITICAL: refund failed, manual reconciliation needed', { userId, generationId, credits: req.creditsUsed, error: refundErr.message }); }`
  - Then keep the existing `update({ status:'failed' }).eq('id', inserted.id)` and `throw err` (outer handler => 502). Refund uses the SAME `userId`, `cleanText.length` (=> same cost), and `generationId` (= original `ref_id`) so the ledger nets to zero and links back to the failed generation.
  - Import `refundCredits` from `creditService.js`. This catch is reached only AFTER a successful deduct, so a refund here is always valid.
  - If `refundCredits` itself throws, log a CRITICAL manual-reconciliation line (credits stuck) — do NOT mask the original 502.

### 5. `storefrontRoutes.js` (keyed by generationId — correction #5)
- `express.Router()`; `router.use(cors({ origin: '*' }))` as a belt-and-suspenders default (the global delegate in §6 is the authoritative mechanism; this does not conflict — same `*` value).
- `const embedLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders:true, legacyHeaders:false, keyGenerator:(req)=>req.ip, message:{ success:false, error:'Too many requests from this IP, please try again after a minute' } });`
- `router.get('/embed/:generationId', embedLimiter, handler)`:
  - Validate `generationId` is a UUID; if not, 404 (a malformed id must not hit Postgres as a bad-uuid 500).
  - `supabase.from('audio_generations').select('id, chapter_id, audio_url, duration, alignment').eq('id', generationId).eq('status','completed').maybeSingle();` (queries the unique PK => no ordering heuristic needed; maybeSingle avoids `PGRST116` on zero rows)
  - DB error => 500 `{ success:false, error:'Internal server error' }`.
  - no row or null `audio_url` => 404 `{ success:false, error:'Not found' }` (covers unknown id, non-UUID, and still-processing/failed).
  - else 200 `{ success:true, generationId: data.id, chapterId: data.chapter_id, audioUrl: data.audio_url, durationSeconds: data.duration, alignment: data.alignment || [] }`.

### 6. `index.js`
- **Replace the static global CORS (`:22-27`) with ONE delegate (correction #6).** `cors` has no `skip` and mount-order does not prevent the restricted header from being set, so branch inside a single `app.use(cors(delegate))`:
  ```
  const corsDelegate = (req, callback) => {
    if (req.path.startsWith('/api/storefront')) return callback(null, { origin: '*' });
    callback(null, { origin: allowedOrigin, credentials: true, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','Idempotency-Key'] });
  };
  app.use(cors(corsDelegate));
  ```
- Global `apiLimiter` (`:31-42`) add `skip: (req) => req.path.startsWith('/api/storefront')` (express-rate-limit DOES support `skip`) so storefront is not throttled at 5/min; it owns a 60/min limiter.
- `import storefrontRouter from './routes/storefrontRoutes.js';` and `app.use('/api/storefront', storefrontRouter);` (no `authMiddleware`). Because the delegate is order-independent, mount location is not fragile; still mount it near the other routers.
- `/api/audio` auth + router (`:50-51`) unchanged.

## Risks / explicitly out of scope
- **Refund failure window.** If `synthesizeText` succeeds but `uploadAudio` throws, or `refund_credits` itself fails, credits can be temporarily/durably stuck. Mitigation in §4 logs a CRITICAL reconciliation line; consider a periodic reconciliation job (ledger sum vs `users.credits`) later.
- **Public embed is fully open by `generationId`** (no `is_public` column). Anyone with a generation UUID can read completed audio+alignment. UUIDs are unguessable but the endpoint is unauthenticated by design (task requirement).
- **Missing-row vs insufficient-credits collapse:** the deduct RPC's 0-row UPDATE returns 402 even if the `users` row is absent. Mock seed + real user rows must exist.
- Storefront limiter is in-memory (per-instance); fine on a single Render instance, needs a shared store for multi-instance.
- Client `AudioStorefrontWidget` / storefront host must now supply `generationId` (returned by synthesize) rather than `chapterId` to build the embed URL — DEV A / storefront side, out of `/server` scope.

## Validation (implementer runs after restart)
1. Apply `002`, restart; confirm boot logs no error, `/health` 200.
2. Happy path synthesize (mock user, credits 500, short text) => 200; verify `credit_transactions` has one `-cost` row (`reason='synthesis'`, `ref_id` = generation id) and `users.credits` dropped by exactly `cost`.
3. Two concurrent POSTs, SAME `Idempotency-Key` => exactly ONE ledger row, one deduction; loser polls to the same payload.
4. Replay after completion => 200 cached, no new ledger row.
5. Set `users.credits=0`, new key => HTTP 402 `{ success:false, error:'Insufficient credits. Please top up your wallet.' }`, placeholder row `status='failed'`.
6. Spam many DIFFERENT keys => balance never goes below 0 (atomic `WHERE credits >= cost`), each charge logged.
7. **Refund:** force `synthesizeText`/`uploadAudio` to fail (bad TTS key / bad bucket) => response 502, row `status='failed'`, and a `credit_transactions` `reason='refund'`, `amount=+cost` row; net `users.credits` == pre-request balance (deduct + refund cancel).
8. `GET /api/storefront/embed/:generationId` (a real completed generation id) with `Origin: https://random.example` => 200, `Access-Control-Allow-Origin: *`, no auth header required; payload has `generationId, chapterId, audioUrl, durationSeconds, alignment`.
9. `/api/audio/*` still returns the restricted `Access-Control-Allow-Origin: <FRONTEND_URL>` (delegate branch works). Unknown/non-UUID/processing `generationId` => 404; 61st storefront hit/min => 429.

## Out of scope (do not implement here)
- DEV A / storefront host must pass `generationId` (not `chapterId`) to build the embed URL.
- Multi-instance shared rate-limit store; periodic ledger reconciliation job.
