# Backend Startup Failure — Implementation Plan

## A. Executive Summary

The backend fails to start because **none of its runtime dependencies are installed**. `server/node_modules` contains only 28 packages — all belonging to `nodemon` (devDependency) and its transitive graph. All 17 declared production dependencies (`express`, `@supabase/supabase-js`, `@google/generative-ai`, `cors`, `dotenv`, `axios`, `uuid`, etc.) are absent.

The first crash is the visible one: `ERR_MODULE_NOT_FOUND: Cannot find package '@google/generative-ai'`. This error occurs because `server/src/routes/studioRoutes.js` top-level-imports `llmDirector.js` (line 6), which imports `GoogleGenerativeAI` from `@google/generative-ai`. When `index.js` loads at line 12 (`import studioRoutes from './routes/studioRoutes.js'`), Node.js evaluates the entire transitive import chain and immediately throws.

The frontend Network Error is a **symptom, not a cause**: the backend never binds to port 4001, so every request from `MyBooks.jsx` → `getBooks()` → `api.get('/api/studio')` receives `ERR_CONNECTION_REFUSED`. The red "Network Error" banner is the standard axios network-failure display in `MyBooks.jsx`.

## B. Root Cause Analysis

### Confirmed

**RC-1: No runtime dependencies installed in server/**
- `server/node_modules` has 28 entries — all nodemon/dev deps
- `@google/generative-ai` missing → confirmed by `ls server/node_modules/@google` = "No such file or directory"
- `express` missing → confirmed by `ls server/node_modules/express` = "No such file or directory"
- `@supabase/supabase-js` missing → confirmed
- `dotenv`, `cors`, `axios`, `uuid` all missing → confirmed
- `server/package-lock.json` does NOT exist — no lockfile to restore from

**RC-2: Frontend API URL matches backend port**
- `client/.env`: `VITE_API_URL=http://localhost:4001`
- `server/.env`: `PORT=4001`
- `server/src/index.js:25`: `const PORT = process.env.PORT || 4001`
- These agree. The frontend is correctly targeting the backend port.

**RC-3: /api/studio route exists and is mounted**
- `server/src/routes/studioRoutes.js:39` — `router.get('/', ...)` handles `GET /api/studio`
- `server/src/index.js:101` — `app.use('/api/studio', authMiddleware, studioRoutes)` mounts it
- Route registration is correct once the server starts

### Likely

**LC-1: `npm install` was never run (or was undone) in server/**
- `package-lock.json` absent — suggests this is either a fresh clone or the lockfile was never generated
- `client/node_modules` also has only 2 entries — same pattern for the client
- Both projects share this symptom: dependencies declared but not installed

**LC-2: No other startup blockers beyond missing deps**
- `server/.env` has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT=4001`, `TTS_PROVIDER=gtts` — all required vars present
- `server/.env` does NOT have `NODE_ENV` — auth middleware will use strict Supabase token validation (not dev mock mode). This is fine since the frontend sends auth headers via the interceptor.
- `server/.env` does NOT have `GEMINI_API_KEY` — `llmDirector.js` initializes with `undefined`, but this only fails at call time, not at import time. Not a startup blocker.

### Unverified (requires server start)

- Whether `audioRoutes.js`, `documentRoutes.js`, `libraryRoutes.js` have any other missing dependencies or code errors
- Whether the Supabase connection works with the credentials in `.env`
- Whether the `/api/studio` query succeeds against the remote Supabase instance

## C. Dependency Resolution

**Root cause package**: `@google/generative-ai@^0.24.1` (declared in `server/package.json` line 14)

**Why the specific error points here**:
1. `index.js:12` imports `studioRoutes`
2. `studioRoutes.js:6` imports `generateSpatialScript` from `../services/llmDirector.js`
3. `llmDirector.js:1` imports `GoogleGenerativeAI` from `@google/generative-ai`
4. Node.js ESM evaluates imports top-down at module load time — this chain fails immediately on startup

**SDK compatibility**: The code uses:
- `new GoogleGenerativeAI(apiKey)` — constructor, present since v0.1.0
- `genAI.getGenerativeModel({ model, generationConfig })` — present since v0.1.0
- `model.generateContent(prompt)` → `result.response.text()` — standard API

The declared version `^0.24.1` is compatible. No SDK migration needed.

**Fix**: Run `npm install` in `server/`. This will:
1. Install all 17 production dependencies declared in `server/package.json`
2. Create `package-lock.json` (previously absent)
3. Resolve `@google/generative-ai` to `^0.24.1` range (latest 0.x within that range)

The same applies to `client/` (2 entries in node_modules), but the task scope is the backend.

## D. Backend Startup Recovery

After `npm install`, verify with:

```bash
cd /Users/vamshikrishna/vernacular-audiobook/server
npm run dev
```

Expected output:
```
[DEV_BYPASS_CREDITS ACTIVE] ...  (only if DEV_BYPASS_CREDITS=true in .env — currently absent, so no warning)
Server running on port 4001
Health check: http://localhost:4001/health
```

If another `ERR_MODULE_NOT_FOUND` appears, it indicates an additional missing dependency — run `npm install` again (it should be idempotent) and check the new error.

If the server starts but crashes later with a different error, inspect the new stack trace before taking action.

## E. Frontend API Verification

Once the backend is running, verify `/api/studio` is reachable:

```bash
curl -s http://localhost:4001/health | jq .
```

Expected: `{"status":"ok","timestamp":"..."}`

Then test the authenticated endpoint (requires a Supabase session token):

```bash
curl -s http://localhost:4001/api/studio \
  -H "Authorization: Bearer <valid_supabase_token>" | jq .
```

In dev mode (no auth header), the middleware sets `req.user = { id: '00000000-0000-0000-0000-000000000001' }` only when `NODE_ENV=development`. Since `.env` lacks this, requests without a token will get `401 Unauthorized`. The frontend must send a valid Supabase session token.

Then open the browser to `http://localhost:5175/my-books` and confirm the "Network Error" banner disappears and the book list renders.

## F. Implementation Steps

### Step 1: Install server dependencies
```bash
cd /Users/vamshikrishna/vernacular-audiobook/server
npm install
```
- **Why**: All 17 production dependencies are missing from `node_modules`
- **Change**: Creates `node_modules/` with all deps + `package-lock.json`
- **Must remain unchanged**: `package.json`, source files, `.env`

### Step 2: Verify backend startup
```bash
cd /Users/vamshikrishna/vernacular-audiobook/server
npm run dev
```
- **Why**: Confirm the import chain resolves and server binds to port 4001
- **Success criteria**: No `ERR_MODULE_NOT_FOUND`; log says "Server running on port 4001"

### Step 3: Verify health endpoint
```bash
curl -s http://localhost:4001/health
```
- **Why**: Confirms Express is responding before testing auth-protected routes

### Step 4: Verify frontend My Books page
Open browser to `http://localhost:5175/my-books` with an active Supabase session.
- **Why**: Confirms the end-to-end request chain works
- **Success criteria**: No "Network Error" banner; book list renders (empty state is acceptable if no books exist)

### Step 5 (conditional): Install client dependencies if needed
If the frontend dev server shows module resolution errors:
```bash
cd /Users/vamshikrishna/vernacular-audiobook/client
npm install
```
- **Why**: `client/node_modules` has only 2 entries — likely needs full installation too
- **Scope note**: Only if frontend fails to compile; otherwise leave as-is

## G. Regression Tests

| Check | How |
|-------|-----|
| Server starts without import errors | `npm run dev` shows "Server running on port 4001" |
| Health endpoint responds | `curl localhost:4001/health` returns `{status:"ok"}` |
| `/api/studio` responds (with auth) | `curl` with Bearer token returns book list JSON |
| My Books page loads (no Network Error) | Browser shows bookshelf, not red error banner |
| Existing Studio synthesis still works | Create a book, trigger synthesis — no module errors |
| Existing audio routes work | `/api/audio/synthesize` endpoint responds |
| No `npm install` side effects on existing deps | `npm ls --depth=0` shows expected packages |
| No `.env` changes made | Diff of `server/.env` is empty |
| No source file changes | Diff of `server/src/` is empty |

## H. Risks and Rollback

| Risk | Likelihood | Mitigation | Rollback |
|------|-----------|------------|----------|
| `npm install` pulls a breaking version of `@google/generative-ai` | Low — semver `^0.24.1` constrains to 0.x | Lockfile created by install pins exact version | `rm -rf node_modules && npm install` re-runs with same range |
| `npm install` breaks an existing package | Negligible — `node_modules` was empty of runtime deps | N/A | Same as above |
| Supabase credentials in `.env` are stale | Unknown — unverified until server starts | Check health and a simple DB query after start | No rollback needed; bad credentials produce a clear error |
| Missing `NODE_ENV=development` causes auth failures | Low — frontend sends Supabase token via interceptor | Verify with a logged-in user session | Add `NODE_ENV=development` to `server/.env` |
| Client `npm install` needed but not done | Medium — client/node_modules also sparse | Verify frontend dev server in Step 4 | Run `npm install` in `client/` as Step 5 |

## I. Acceptance Criteria

1. `cd server && npm run dev` starts without any `ERR_MODULE_NOT_FOUND` or `Cannot find module` errors
2. `GET http://localhost:4001/health` returns `{"status":"ok"}`
3. The My Books page in the browser loads without the red "Network Error" banner
4. No source files in `server/src/` were modified
5. No `package.json` was modified
6. No `.env` files were modified
7. `server/package-lock.json` is created by `npm install`
