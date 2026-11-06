# Environment & Deployment Configuration

## Deployment Status (verified 2026-11-06)
- Backend (Railway): `https://vernacular-audiobook-production.up.railway.app` - health returns `{"status":"ok",...}`
- Frontend (Vercel): `https://vernacular-audiobook.vercel.app` - SPA (Vite build served by the `client` Vercel project)

## Deployment Configuration Files
| File | Purpose |
|------|---------|
| `railway.json` | Railway Config-as-Code for the backend service (RAILPACK builder, `cd server && npm install` build, `cd server && npm start` start, `/health` healthcheck, 300s timeout, ON_FAILURE restart x5). Actively applied on every deploy. Deprecated by Railway - stops being read on **2026-12-01**. |
| `.railway/railway.ts` | Generated IaC mirror of `railway.json` (`railway config migrate --apply --variables=unmanaged`, variables stay dashboard-managed). NOT yet cut over - to finish before 2026-12-01: `railway config migrate cutover`, then `railway config plan`, then `railway config apply`, then delete `railway.json`. |
| `client/vercel.json` | Vercel config for the frontend only: framework `vite`, build `npm run build`, output `dist`, catch-all rewrite to `/index.html` for SPA routing. No `server/vercel.json` exists - the backend is Railway-only. |
| `.vercel/project.json` + `client/.vercel/project.json` | Both link Vercel project `client` (`prj_fW5pBz7VD3638WisBYjngZshh7Eu`, org `team_DcihWwjtQuCxOXDkftsB76Yn`). This is the live project that serves `vernacular-audiobook.vercel.app` (domain is aliased to this project). A separate empty `vernacular-audiobook` Vercel project exists and is unused. |

## Build / Start Process
- Server: `npm start` runs `node src/bootstrap.js`, which loads the repo-root `.env` (dotenv never overrides real env vars, so Railway dashboard variables win in production) and imports `src/index.js`. Listens on `PORT` (4001), serves `/health`.
- Client: `npm run build` (Vite) outputs `client/dist/`; Vercel deploys that directory.

## Environment Variables Configured

### Railway (Backend) - actual live set
| Variable | Value |
|----------|-------|
| SUPABASE_URL | https://znhhavbeqxoydojywttu.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | (set - actual key) |
| SUPABASE_BUCKET_NAME | audiobook |
| FRONTEND_URL | https://vernacular-audiobook.vercel.app |
| GNANI_API_KEY_ID | (configured) |
| GROQ_API_KEY | (configured) |
| TTS_PROVIDER | gnani |
| TTS_FALLBACK_ENABLED | true |
| NODE_ENV | production |
| PORT | 4001 |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | (set but UNUSED by the server code - Google OAuth lives in Supabase; safe to delete from Railway) |

Optional server variables with safe defaults (see `server/.env.example`): `GNANI_API_KEY`, `GNANI_TTS_ENDPOINT`, `GNANI_ACCESS_TOKEN`, `REDIS_URL` (in-memory queue fallback), `GROQ_DIRECTOR_MODEL` / `GROQ_CLASSIFIER_MODEL` / `GROQ_NORMALIZER_MODEL` (default `qwen/qwen3.8-27b`). `ALLOW_DEV_MOCK_USER` and `DEV_BYPASS_CREDITS` must never be enabled in production.

### Vercel (Frontend)
| Variable | Value |
|----------|-------|
| VITE_SUPABASE_URL | https://znhhavbeqxoydojywttu.supabase.co |
| VITE_SUPABASE_ANON_KEY | (configured) |
| VITE_API_URL | https://vernacular-audiobook-production.up.railway.app |
| VITE_FRONTEND_URL | https://vernacular-audiobook.vercel.app |

## OAuth Configuration
**Supabase Project**: znhhavbeqxoydojywttu (Google provider configured in Supabase dashboard, not in app env)

### URL Settings (configured via dashboard)
- Site URL: `https://vernacular-audiobook.vercel.app`
- Redirect URLs:
  - `https://vernacular-audiobook.vercel.app/auth/callback`
  - `http://localhost:5175/auth/callback`

## Health Check
Run: `curl https://vernacular-audiobook-production.up.railway.app/health`
Expected: `{"status":"ok","timestamp":"..."}`
(Note: `vernacular-audiobook.vercel.app/health` returns the SPA index.html by design - the catch-all rewrite routes every path to index.html; health checks must target the Railway domain.)
