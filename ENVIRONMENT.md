# Updated Environment Configuration

## Deployment Status
- ✅ **Railway Backend**: Running at `https://vernacular-audiobook-production.up.railway.app`
- ✅ **Vercel Frontend**: Deployed at `https://vernacular-audiobook.vercel.app`

## Environment Variables Configured

### Railway (Backend)
| Variable | Value |
|----------|-------|
| SUPABASE_URL | https://znhhavbeqxoydojywttu.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | (set - actual key) |
| SUPABASE_BUCKET_NAME | audiobook |
| FRONTEND_URL | https://vernacular-audiobook.vercel.app |
| GNANI_API_KEY_ID | (configured) |
| GROQ_API_KEY | (configured) |
| GOOGLE_CLIENT_ID | (configured) |
| GOOGLE_CLIENT_SECRET | (configured) |
| TTS_PROVIDER | gnani |
| TTS_FALLBACK_ENABLED | true |
| NODE_ENV | production |
| PORT | 4001 |

### Vercel (Frontend)
| Variable | Value |
|----------|-------|
| VITE_SUPABASE_URL | https://znhhavbeqxoydojywttu.supabase.co |
| VITE_SUPABASE_ANON_KEY | (configured) |
| VITE_API_URL | https://vernacular-audiobook-production.up.railway.app |
| VITE_FRONTEND_URL | https://vernacular-audiobook.vercel.app |

## OAuth Configuration
**Supabase Project**: znhhavbeqxoydojywttu

### URL Settings (configured via dashboard)
- Site URL: `https://vernacular-audiobook.vercel.app`
- Redirect URLs:
  - `https://vernacular-audiobook.vercel.app/auth/callback`
  - `http://localhost:5175/auth/callback`

## Health Check
Run: `curl https://vernacular-audiobook-production.up.railway.app/health`
Expected: `{"status":"ok","timestamp":"..."}`