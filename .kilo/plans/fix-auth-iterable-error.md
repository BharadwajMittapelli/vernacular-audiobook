# Fix: "number 1 is not iterable" Error in Auth Flow

## Problem
Application crashes on load with error: "number 1 is not iterable (cannot read property Symbol(Symbol.iterator))"

## Root Cause Analysis

### Primary Issue: API Return-Shape Drift
The error occurs because `supabase.auth.onAuthStateChange()` returns different shapes across Supabase versions:
- **Early v2.x:** Returns `{ data: { subscription } }` (object with nested subscription)
- **Late v2.x / HMR edge cases:** May return a primitive (number, string) or incomplete object during hot-module replacement
- **Internal state corruption:** During Vite HMR, if the Supabase client is re-initialized mid-session, internal counters (like `nextInstanceID = 1`) can be mistakenly iterated over

The current code assumes a consistent return shape:
```typescript
const result = supabase.auth.onAuthStateChange(...);
subscription = result?.data?.subscription ?? null;
```

If `result` is a number (e.g., `1`) due to HMR state corruption or version mismatch, `result?.data` returns `undefined`, but internal Supabase code may have already attempted to iterate over `result` before returning it.

### Secondary Issue: Defensive Code Masking Real Errors
The try/catch around the subscription hides the actual error, making diagnosis difficult. The real crash happens inside Supabase's internal iteration logic, not in our code.

### Tertiary Issue: Missing NavigateContext (Fixed)
`AuthPage` now has `NavigateContext.Provider` wrapper in App.jsx — resolved.

## Fix Plan

### Step 1: Align Supabase Version
**File:** `client/package.json`

Update to a stable, recent version that has consistent API behavior:
```json
"@supabase/supabase-js": "^2.43.0"
```

Then run clean install:
```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

**Why not pin to exact version:** Using `^2.43.0` allows patch updates for bug fixes while ensuring we get a version with stable API contracts.

### Step 2: Resilient Subscription Handling
**File:** `client/src/context/AuthContext.tsx`

Replace lines 38-63 with safe extraction that handles multiple return shapes:

```typescript
// ponytail: handle onAuthStateChange return shape drift across Supabase versions
const result = supabase.auth.onAuthStateChange((event, newSession) => {
  if (event === 'SIGNED_OUT') {
    setSession(null);
    setError(null);
  } else if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && newSession) {
    setSession(newSession);
    setError(null);
  }
});

// Resiliently extract subscription — handles { data: { subscription } }, { subscription }, or direct subscription
let subscription: { unsubscribe: () => void } | null = null;
if (result && typeof result === 'object') {
  subscription = (result as any)?.data?.subscription 
    ?? (result as any)?.subscription 
    ?? null;
}

return () => {
  // ponytail: guard against undefined/null subscription during cleanup
  if (subscription && typeof subscription.unsubscribe === 'function') {
    subscription.unsubscribe();
  }
};
```

**Key changes:**
1. Removed try/catch — let errors surface for proper debugging
2. Added type guard `typeof result === 'object'` before accessing properties
3. Fallback chain: `{ data: { subscription } }` → `{ subscription }` → `null`
4. Cleanup guard: checks `unsubscribe` is a function before calling

### Step 3: Verify Build
Run typecheck and build:
```bash
cd client
npm run typecheck
npm run build
```

## Files to Modify
1. `client/package.json` — Update Supabase version to `^2.43.0`
2. `client/src/context/AuthContext.tsx` — Implement resilient subscription handling
3. Run `npm install` in client directory (clean install recommended)

## Verification Steps
1. Clear browser cache and localStorage (`Application > Storage > Clear site data`)
2. Remove `node_modules` and reinstall: `rm -rf node_modules && npm install`
3. Start dev server: `npm run dev`
4. Navigate to `http://localhost:5175/`
5. Verify landing page loads without crash
6. Click "Start Creating Free" button
7. Verify auth modal opens
8. Test Google sign-in flow
9. Verify redirect to `/my-books` after successful auth
10. Test page reload during auth flow (HMR scenario)

## Risk Assessment
- **Low Risk:** Using `^2.43.0` allows safe patch updates
- **Low Risk:** Resilient extraction handles both old and new API shapes
- **Medium Risk:** If 2.43.0 has issues, try 2.44.0 or check Supabase changelog

## Debugging Tips (if issue persists)
Add temporary logging to identify the actual return shape:
```typescript
const result = supabase.auth.onAuthStateChange((event, newSession) => {
  console.log('[Auth] Event:', event, 'Session type:', typeof newSession);
  // ... existing handler
});
console.log('[Auth] onAuthStateChange returned:', result, 'Type:', typeof result);
```

Check for multiple Supabase versions in lockfile:
```bash
npm ls @supabase/supabase-js
npm ls @supabase/auth-js
```

## Open Questions
1. What is the exact Supabase project configuration? (email confirmation enabled/disabled?)
2. Are there any custom Supabase middleware or edge functions that might affect auth responses?
3. Is this error reproducible on first load only, or also after HMR?
