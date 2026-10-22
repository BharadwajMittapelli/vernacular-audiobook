# V2 Phase 2 — JWT Auth + Client Interceptor

## Objective
Replace the backend auth stub with real Supabase JWT validation and wire the frontend Axios client to attach the active user's session token automatically.

---

## Context (verified against repo)

| Item | Location | Status |
|------|----------|--------|
| Auth stub | `server/src/middleware/auth.js` | Hardcodes mock user, no token validation |
| Routes using auth | `server/src/index.js:74` — `app.use('/api/audio', authMiddleware)` | `audioRoutes.js` reads `req.user?.id` with `|| mock-id` fallback at lines 108, 314 |
| Supabase server client | `server/src/config/supabase.js` | Service-role key; `autoRefreshToken: false`, `persistSession: false` |
| Supabase client v2 | `@supabase/supabase-js: ^2.39.0` | Installed on both client and server |
| Client Supabase client | `client/src/lib/supabaseClient.ts` | Anon-key client; used by `AuthContext.tsx` which calls `getSession()` today |
| Client axios instance | `client/src/services/api.js` | No interceptor; baseURL from `VITE_API_URL` |
| Prod env | server `.env` has no `NODE_ENV`; client `.env` has anon key set |

**Key finding:** Routes already use `req.user?.id \|\| mock-id` — after this change the fallback path is unreachable in prod but harmless in dev. The mock user `00000000-0000-0000-0000-000000000001` exists in `users` (from migration 002 seed).

---

## Decisions

1. **Server `getUser()` is the right tool.** `supabase.auth.getUser(token)` internally verifies JWT signature (HS256 against Supabase secret), checks `exp`, and returns `{ data: { user }, error }`. It needs only the service-role key already in the server client — no separate secret. ✓ Matches constraint 1 (service key stays server-only).

2. **Dev fallback stays in `auth.js`, not in routes.** `NODE_ENV === 'development'` with no `Authorization` header → set the mock user and `next()`. Any other missing-header or invalid-token case → 401 immediately.

3. **Client interceptor is async.** `getSession()` is async; we `await` it, then mutate `config.headers.Authorization`. Return the config either way.

4. **Null-safety on `session.access_token`.** `getSession()` always returns a session object when a user is signed in, but we guard with `?.` to avoid TypeError if edge-case returns `{ session: null }`.

---

## Files to modify

### 1. `server/src/middleware/auth.js` (rewrite)

```js
import { supabase } from '../config/supabase.js';

/**
 * Validates Supabase JWT from Authorization header.
 * Dev fallback: missing header → mock user (so local unauthenticated dev
 * testing doesn't break). Invalid/expired tokens are always rejected.
 */
export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  // Missing header → dev fallback, prod reject
  if (!header) {
    if (process.env.NODE_ENV === 'development') {
      req.user = { id: '00000000-0000-0000-0000-000000000001' };
      return next();
    }
    return res.status(401).json({ success: false, error: 'Missing Authorization header' });
  }

  // Strip "Bearer " prefix
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    console.error('authMiddleware error:', err.message);
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
```

**Notes:**
- `res.status(401).json(...)` short-circuits; no `next()` call needed after.
- `try/catch` wraps the async `getUser` so unexpected errors don't leak as 500s but surface as 401s.
- The `|| mock-id` fallback in `audioRoutes.js` lines 108/314 becomes dead code for authenticated requests but is harmless to leave (the task says don't modify routes).

### 2. `client/src/services/api.js` (add interceptor, file stays `.js`)

Add after the `api` axios instance creation (after line 14):

```js
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
```

Add the import at the top (before `import axios from 'axios';`):

```js
import { supabase } from '../lib/supabaseClient';
```

**Notes:**
- Import path omits `.ts` extension — Vite resolves it transparently.
- `session?.access_token` guard prevents attaching an empty string if session exists but is malformed.
- `api` is exported as default on line 56; the interceptor mutates the shared instance so all helpers (`synthesizeAudio`, `synthesizeAsync`, etc.) inherit it automatically.

---

## Validation Plan

### Server syntax
```bash
node --check server/src/middleware/auth.js
```

### Client build
```bash
cd client && npm run build
```
Vite compiles `.ts`/`.js` + applies React plugin — any type/import error surfaces here.

### Runtime smoke (manual)
1. Start server (`npm run dev` from `server/`) and client (`npm run dev` from `client/`).
2. In browser DevTools console, sign in via Supabase (or use the app's sign-in UI if present).
3. Confirm `Authorization: Bearer eyJ...` header appears on outbound `/api/audio/*` requests.
4. Hit an authenticated endpoint with no token (e.g., curl without header) → expect `401 {"success":false,"error":"Missing Authorization header"}`.
5. Hit with a stale/expired token → expect `401 {"success":false,"error":"Invalid or expired token"}`.
6. Local dev without auth header → expect 200 (mock user fallback active because `NODE_ENV=development` by default).

---

## Constraints Checklist
- ✅ Service-role key only used server-side (`supabase` import from `server/src/config/supabase.js`).
- ✅ Client interceptor is async (`await getSession()` inside `.use()`).
- ✅ Syntax check: `node --check` for server; `vite build` for client.
- ✅ No changes to routes, queues, or other middleware.
- ✅ No changes to `.env` files (existing vars are sufficient).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `supabase.auth.getUser()` requires explicit `aud` claim match by default. Supabase JWTs have `aud: "authenticated"` — should pass. If it fails, the error message will surface in the 401 response for debugging. | Check during smoke test step 4. |
| `NODE_ENV` not set in local `.env` — Node defaults to `undefined`, so `process.env.NODE_ENV === 'development'` is **false**. Dev fallback would NOT fire locally unless `NODE_ENV=development` is set. | Add `NODE_ENV=development` to `server/.env` (non-secret, safe to commit or document in `.env.example`). See Action item below. |
| Axios interceptor mutates config in-place; if a request is retried or shared, token could be stale on retry. | Not applicable to current flow (no retry logic in api.js). Future-proof: create fresh config via `{ ...config, headers: { ...config.headers } }` only if retries are added. |
| Existing routes do `req.user?.id \|\| mock-id` — after this change `req.user` is always defined on valid requests. The fallback remains harmless dead code. | Leave routes untouched per task constraint. |

---

## Additional Action: Update `.env.example`

Append `NODE_ENV=development` to `server/.env.example` so the dev fallback is documented:

```
NODE_ENV=development          # development | production
```

Also add it to local `server/.env` before smoke testing (so the dev fallback actually fires locally).

---

## Out of Scope
- Adding RLS policies on `chapters` or other tables (done in migration 005 — RLS enabled but no policies; out of scope for this auth task).
- Token refresh / silent re-auth on expiry (future; not needed for V2 Studio UI MVP).
- Route-level role checks beyond `authMiddleware`.
- Any changes to `AuthContext.tsx`, `creditGuard.js`, or store routes.
- Client-side route guards (frontend auth UI already handles sign-in/sign-out).
