# Temporary DEV Credit Bypass (DEV_BYPASS_CREDITS)

**Branch:** `master`
**Files in scope:** `server/src/services/creditService.js`, `server/src/routes/audioRoutes.js`, `server/src/routes/studioRoutes.js`, `server/.env.example`

## Goal
During dev testing, no synthesis path may return 402 / mark a job failed for insufficient credits. Gate everything on `process.env.DEV_BYPASS_CREDITS === 'true'` so it ships inert to prod and is removed by deleting the guarded lines + env var.

## Why the original file-scope is not enough (verified in code)
`deductCredits` is only one of three 402 sources:
1. `audioRoutes.js:232` sync `/synthesize` → calls `deductCredits` (covered by file-scope change)
2. `audioRoutes.js:338-351` `/synthesize-async` → `get_user_balance` RPC pre-check, 402 raised in the route, `deductCredits` never reached
3. `studioRoutes.js:147-157` Studio `/process` → direct `users.credits` SELECT, 402 raised in the route

Approved scope: all three, env-flag gated.

## Decisions
- **Return shape:** match the existing contract. `deduct_credits` RPC `returns integer` (balance after deduction, `migrations/002_ledger_deduct_refund.sql:34`), and `deductCredits` currently returns that bare integer. Return `99999`, **not** `{ success: true, remaining: 99999 }`. Callers that assign the value never read it (`req.remainingCredits` at `audioRoutes.js:233`; `let remaining` at `synthesisQueue.js:109-111`) — this was checked — but integer parity avoids a latent contract break if a real `deduct` and the bypass are ever mixed. Every `InsufficientCreditsError` catch path is skipped entirely by the early return, which is what unblocks the UI.
- **Read env inside the function**, not at module scope: `server/src/index.js:15` calls `dotenv.config()` after static ESM imports are evaluated, so a top-level constant could capture `undefined`.
- Known accepted side effect (no code change needed): with no ledger row written, the failure-path `refundCredits` calls raise `NO_MATCHING_DEDUCTION` in the DB function. All three refund call sites already swallow it via `console.error('CRITICAL: ...')` (`audioRoutes.js:278-286`, `synthesisQueue.js:171-179`, `studioRoutes.js:536-540`). Expect noisy logs, not broken flows.
- Known accepted side effect: `GET /api/audio/credits` (`audioRoutes.js:456-474`) still returns the real balance, so the UI badge may show `0` while synthesis succeeds. Dev-only cosmetic mismatch.

## Tasks

### 1. `server/src/services/creditService.js` — bypass deduction
At the top of `deductCredits` (before `calculateCost` / the RPC call at line 15-20):

```javascript
export async function deductCredits(userId, characterCount, referenceId) {
  // DEV OVERRIDE FOR TESTING — remove with DEV_BYPASS_CREDITS
  if (process.env.DEV_BYPASS_CREDITS === 'true') {
    return 99999;
  }

  const cost = calculateCost(characterCount);
  // ...unchanged
```

Leave `InsufficientCreditsError`, `calculateCost`, and `refundCredits` untouched — refund must stay real for prod parity and its errors are already swallowed.

### 2. `server/src/routes/audioRoutes.js` — skip async pre-check
Guard the upfront balance pre-check block (`lines 333-351`) so it only runs when the flag is off:

```javascript
if (process.env.DEV_BYPASS_CREDITS !== 'true') {
  // existing totalCost + get_user_balance + 402 block, unchanged inside
}
```

`totalCost` stays computed inside the guard (or hoist it — it is only used by this check and the 402 body). Sync `/synthesize` needs no route change: its 402 comes only from `deductCredits` via `InsufficientCreditsError` (`audioRoutes.js:234-246`), already bypassed in task 1. The queue path `synthesisQueue.js:109-123` likewise never sees `InsufficientCreditsError` once task 1 lands — no change there.

### 3. `server/src/routes/studioRoutes.js` — skip bulk pre-check
Same guard around `lines 147-157` (`totalCost` + `users.credits` SELECT + 402):

```javascript
if (process.env.DEV_BYPASS_CREDITS !== 'true') {
  // existing block
}
```

`studioRoutes.js:485` single-chapter synthesize needs no route change (its 402 is caught from `deductCredits`, line 487-492).

### 4. `server/.env.example` — documented, off by default
Add a commented line only (never `true` in the example):

```
# DEV ONLY — forces credit deduction to succeed so UI testing is never blocked. Never set in production.
# DEV_BYPASS_CREDITS=true
```

Set `DEV_BYPASS_CREDITS=true` in local (untracked) `server/.env` for testing.

## Rollout / removal
- Dev: add the var to `server/.env`, restart server.
- Prod: flag absent → every guarded block behaves exactly as today. Confirm `DEV_BYPASS_CREDITS` is not set in the Render/env config before deploying.
- Removal checklist: `grep -rn "DEV_BYPASS_CREDITS" server/src server/.env.example` must return nothing, plus unset the local `.env` var.

## Validation
1. `cd server && npm start` with `DEV_BYPASS_CREDITS=true`; for the test user set `users.credits = 0`: `update public.users set credits = 0 where id = '<dev-user>';`
2. `POST /api/audio/synthesize` → expect 200 with `status: 'completed'`, **not** 402; `audio_generations.credits_used` still populated.
3. `POST /api/audio/synthesize-async` (multi-chapter book) → expect 202, jobs run; no chapter marked `failed` for credits; book reaches `completed`.
4. `POST` Studio `/process` for a book → expect synthesis to proceed; single-chapter studio synthesize route returns audio, not 402.
5. Unset the flag, restart, repeat step 2 with `credits = 0` → **must** return 402 again (proves the prod path is intact).
6. Forced-failure run with the flag on: expect audio still generated but `CRITICAL: ... refund failed ... NO_MATCHING_DEDUCTION` in logs — accepted noise, not a failure.
7. No new lint/type errors; only the four listed files are touched, and there is no migration or DB change.

## Out of scope
- No Redis/queue durability work, no auth changes, no UI badge changes, no per-user dev allowance.
- Do not add a fallback that mints real credits into `users.credits`.
