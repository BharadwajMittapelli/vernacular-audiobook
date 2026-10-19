# Dev Credit Bypass Plan

## Goal
Temporarily force `deductCredits` to succeed during dev testing to prevent UI synthesis from being blocked by credit checks.

## Context
- **File**: `server/src/services/creditService.js`
- Current implementation has `isCreditBypassed()` function that checks `DEV_BYPASS_CREDITS === 'true'` and `NODE_ENV !== 'production'`, returning `99999` early
- `deductCredits` returns the result from `supabase.rpc('deduct_credits', ...)` which is expected to be a numeric remaining credit balance
- Callers use the returned value as `remaining` in `req.remainingCredits` (audioRoutes.js:234)
- Task requests returning `{ success: true, remaining: 99999 }` object instead of plain number

## Decision Points
1. **Return format incompatibility**: Current code returns number; task specifies object `{ success: true, remaining: 99999 }`. This breaks callers expecting numeric remaining credits. Need to reconcile.
2. **Hard-coded vs env-based**: Task asks to "comment out or return early before throwing InsufficientCreditsError" - ambiguous whether to use existing env flag or hard-code bypass.
3. **Scope**: Should bypass also apply to `InsufficientCreditsError` throw path, or just the successful early return?

## Recommended Approach
Keep existing `isCreditBypassed()` logic but modify early return to match task requirement while maintaining backward compatibility:
- Return an object with `success` and `remaining` properties that callers can handle
- Since existing callers expect numeric return (assigned to `remaining`), wrap the return in a compatibility layer
- Alternatively, change all callers to handle object return (higher risk)

## Implementation Plan
1. Locate `deductCredits` in `server/src/services/creditService.js:21`
2. Verify current early return at line 22-24
3. Modify early return to return `{ success: true, remaining: 99999 }` per task spec
4. Update callers if needed to unpack object, or make early return compatible with existing numeric expectation
5. Test that `deductCredits` never throws `InsufficientCreditsError` during dev bypass
6. Validate synthesis flow completes without credit checks

## Data Flow
- `deductCredits` called from:
  - `server/src/routes/audioRoutes.js:233` - assigns to `req.remainingCredits`
  - `server/src/routes/studioRoutes.js:181` - result ignored
  - `server/src/queues/synthesisQueue.js:111` - assigns to `remaining`
- Bypass must apply to all callers uniformly

## Risk
- Changing return type from number to object may break credit balance display in UI
- Hard-coding bypass without env guard risks accidental production use
- If bypass is too broad, may prevent testing of actual credit deduction logic

## Validation
- `deductCredits` returns success without Supabase call when bypass active
- `InsufficientCreditsError` never thrown during dev testing
- Synthesis endpoints return 200 for requests that would fail with insufficient credits
- Existing tests that mock `deductCredits` may need adjustment

## Open Questions
1. Should bypass use existing `DEV_BYPASS_CREDITS` env var or hard-code true?
2. Should return be object `{ success: true, remaining: 99999 }` or number `99999` to avoid breaking callers?
3. Should bypass also skip the cost calculation and Supabase call entirely, or just suppress the error?
