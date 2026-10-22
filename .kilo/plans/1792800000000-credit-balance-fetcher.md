# Plan: Credit Balance Fetcher — GET /api/credits

**Scope:** `server/src/routes/` (new or existing routes)  
**Goal:** Expose the authenticated user's current credit balance for frontend display (sidebar badge, studio UI).

---

## Context (verified)
- No `GET /api/credits` endpoint exists currently.
- `creditService.js` has `deductCredits`/`refundCredits`/`calculateCost` but no getter.
- Balance retrieval pattern already used in `audioRoutes.js:338-343` via `supabase.rpc('get_user_balance', ...)`.
- Frontend needs this for `CreditEstimateBadge` and sidebar display (per ambiguity-resolution-plan line 25, frontend-redesign-plan line 287).
- Auth middleware gates `/api/audio` and `/api/studio`; `/api/credits` should also be auth-gated.

---

## Implementation Options

### Option A: New route in existing router (recommended)
Add `GET /credits` to `audioRoutes.js` (or a new `creditRoutes.js`):
```js
router.get('/credits', async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('credits')
    .eq('id', req.user.id)
    .single();
  if (error || !user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, balance: user.credits });
});
```
Mount under `/api/audio` or a new `/api/credits` prefix.

### Option B: Reuse `get_user_balance` RPC
Call the existing `get_user_balance` RPC instead of direct SELECT:
```js
const { data: balance, error } = await supabase.rpc('get_user_balance', { p_user_id: req.user.id });
```
Same result; slightly more indirection.

---

## Decision: Option A — Direct SELECT on `users` table

**Rationale:** Simpler, no RPC dependency, returns `{ balance }` not raw integer (matches frontend expectation). `get_user_balance` RPC exists mainly for async pre-flight checks where the return value is consumed differently.

**Route placement:** Add to `audioRoutes.js` under the existing `/api/audio` mount (since credits are audio-related). Path: `GET /api/audio/credits`.

**BOLA:** `.eq('id', req.user.id)` ensures users can only fetch their own balance.

---

## File to change
- `server/src/routes/audioRoutes.js` — append `router.get('/credits', ...)` handler after existing routes.

---

## Validation
1. `node --check server/src/routes/audioRoutes.js`
2. Manual test:
   ```
   curl http://localhost:4001/api/audio/credits -H "Authorization: Bearer <token>"
   ```
   Expected: `200 { success: true, balance: <integer> }`
3. Unauthenticated → 401 (handled by authMiddleware).
4. Invalid token → 401.

---

## Open Questions
- Should the endpoint return `{ balance, total_spent, total_earned }`? (Ledger history not requested; keep minimal.)
- Should it expose `credit_transactions` count? (Out of scope for now.)
