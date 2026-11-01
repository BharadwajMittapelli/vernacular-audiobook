# Ekithab AI — Shared Supabase Configuration and Authentication Fix

## 1. Current Configuration Status

### Shared Supabase Project
- **Project ID**: `sgpkxgwnxusjagjnesir`
- **URL**: `https://sgpkxgwnxusjagjnesir.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (retrieved via MCP)
- **Bucket**: `audiobook` (exists)

### Frontend (client/)
- **Supabase Client**: `client/src/lib/supabaseClient.ts` uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Auth**: `AuthContext.tsx` uses the same client for Google OAuth and session management
- **API Service**: `api.js` interceptors attach access token to all requests
- **client/.env.example**: Only contains `VITE_API_URL` — **missing Supabase variables**

### Backend (server/)
- **Supabase Config**: `server/src/config/supabase.js` uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME`
- **Auth Middleware**: `server/src/middleware/auth.js` validates tokens via `supabase.auth.getUser(token)` using service role client
- **server/.env.example**: Contains all required server variables

### Database (RLS Policies)
| Table | RLS Enabled | Policies | Status |
|-------|-------------|----------|--------|
| books | ✅ | 4 (service + user CRUD) | OK |
| audio_generations | ✅ | 4 (service + user CRUD) | OK |
| users | ✅ | 2 (service + user read) | OK |
| credit_transactions | ✅ | 2 (service + user read) | OK |
| downloads | ✅ | 3 (authenticated) | OK |
| favorites | ✅ | 3 (public) | OK |
| playback_history | ✅ | 3 (public) | OK |
| **chapters** | ✅ | **0** | **❌ MISSING** |

**Critical Finding**: The `chapters` table has RLS enabled but **no policies**. The backend uses service role (bypasses RLS), but the frontend using anon key will be blocked from reading/writing chapters.

---

## 2. Root Cause of "Invalid or expired token"

**Primary Cause**: The friend's frontend is configured with (or has cached) a **different Supabase project's credentials**.

Evidence:
1. The frontend Supabase client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables
2. `client/.env.example` does NOT include these variables — they must be added to a local `.env` file
2. If the friend never created `client/.env` with the shared project's credentials, the frontend would fail to initialize or use stale cached values
3. The browser's `localStorage`/`sessionStorage` may contain an old Supabase session from the friend's previous project
4. When the frontend sends this old token to the backend, the backend (configured for the shared project) rejects it with "Invalid or expired token"

**Secondary Issue**: Missing RLS policies on `chapters` table means even with correct auth, the friend's frontend (using anon key) cannot read/write chapters directly.

---

## 3. Telugu PDF Extraction Warning

**Separate Issue**: The warning `Selected language te-IN is Indic, but the PDF extracted no Indic characters` is **NOT related to authentication**.

- Located in `server/src/routes/documentRoutes.js:130-135`
- Triggered when `language` query param is an Indic language (not `en-IN`) but extracted text contains no Indic Unicode characters (`\u0900-\u0D7F`)
- This is a **valid content validation** — the PDF is likely scanned/image-based or actually English
- **No code changes needed** — user should either:
  - Remove `?language=te-IN` query param (for English PDFs)
  - Re-save PDF as searchable (OCR) if it's a scanned document

---

## 4. Required Changes

### A. Environment Changes (ZERO code changes)

| File | Action | Required Variables |
|------|--------|-------------------|
| `client/.env` (create) | **CREATE** new file with shared project credentials | `VITE_SUPABASE_URL=https://sgpkxgwnxusjagjnesir.supabase.co`<br>`VITE_SUPABASE_ANON_KEY=<anon_key_from_above>` |
| `server/.env` | **VERIFY** contains correct shared project credentials | `SUPABASE_URL=https://sgpkxgwnxusjagjnesir.supabase.co`<br>`SUPABASE_SERVICE_ROLE_KEY=<service_role_key>`<br>`SUPABASE_BUCKET_NAME=audiobook` |

### B. Browser/Session Actions (User performs)

1. **Clear browser data**: Friend must clear `localStorage`, `sessionStorage`, and cookies for the app domain
2. **Sign out completely**: If currently signed in, sign out first
3. **Fresh Google OAuth**: Sign in again via Google — this creates a new session in the shared Supabase project

### C. Source Code Changes (Database only — RLS policies)

| File | Change | Reason |
|------|--------|--------|
| **Supabase Dashboard / SQL** | Add RLS policies for `chapters` table | Currently ZERO policies — anon key users (frontend) cannot read/write chapters. Backend uses service role so it works there, but frontend needs policies for any direct access. |

**RLS Policies to Add for `chapters` table**:
```sql
-- Service role full access (for backend)
CREATE POLICY "Service role full access chapters" ON public.chapters
  FOR ALL TO public
  USING (auth.role() = 'service_role');

-- Users can insert own chapters
CREATE POLICY "Users can insert own chapters" ON public.chapters
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

-- Users can read own chapters
CREATE POLICY "Users can read own chapters" ON public.chapters
  FOR SELECT TO public
  USING (auth.uid() = user_id);

-- Users can update own chapters
CREATE POLICY "Users can update own chapters" ON public.chapters
  FOR UPDATE TO public
  USING (auth.uid() = user_id);
```

### D. Verification Steps (No changes)

1. **Google Login**: Friend signs in with Google → session created in shared Supabase Auth
2. **PDF Upload**: Upload a PDF → `POST /api/documents/upload` returns chapters (no auth required)
3. **Book Creation**: `POST /api/studio` with title + chapters → creates book with `user_id = req.user.id`
4. **Audio Generation**: `POST /api/studio/:bookId/synthesize-all` → generates audio, stores in shared bucket
5. **Playback**: Audio URLs are signed (1hr expiry) → playback works

---

## 5. File-by-File Change Summary

| File | Type | Change Required? | Description |
|------|------|------------------|-------------|
| `client/.env` | Env | **CREATE** | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for shared project |
| `server/.env` | Env | **VERIFY** | Ensure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME` match shared project |
| Supabase Dashboard (chapters table) | DB | **ADD** | Create 4 RLS policies for `chapters` table (service role + user CRUD) |
| Browser (friend's machine) | Session | **CLEAR + RE-LOGIN** | Clear storage, sign out, sign in fresh via Google OAuth |
| All other files | Code | **NO CHANGES** | Existing code is correct and compatible |

---

## 6. Testing & Regression Verification

### Pre-conditions
- [ ] Friend has created `client/.env` with correct shared Supabase credentials
- [ ] Friend has verified `server/.env` has correct shared Supabase credentials
- [ ] RLS policies for `chapters` table have been applied in Supabase Dashboard
- [ ] Friend has cleared browser storage (localStorage, sessionStorage, cookies)
- [ ] Both frontend (port 5175) and backend (port 4001) restarted

### Test Checklist
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open app, click "Sign in with Google" | Redirects to Google, returns to app, shows authenticated state |
| 2 | Upload a PDF (English) via Studio | `POST /api/documents/upload` returns parsed chapters |
| 3 | Click "Create Book" / submit | `POST /api/studio` returns created book with `user_id` = friend's auth UID |
| 4 | Verify in Supabase Dashboard → `books` table | New row with `user_id` = friend's UID |
| 5 | Click "Generate Audio" for book | `POST /api/studio/:bookId/synthesize-all` returns 202, starts processing |
| 6 | Wait for completion, check `audio_generations` | Rows created with `user_id` = friend's UID, audio in `audiobook` bucket |
| 7 | Play generated audiobook | Audio plays via signed URLs (1hr expiry) |
| 8 | Verify **your** account still works | Your books, audio, playback unaffected |

### Rollback Plan
- RLS policies: Can be dropped via `DROP POLICY IF EXISTS ... ON public.chapters;`
- Environment: No code changes to revert — just restore previous `.env` files
- No migrations, no schema changes, no data loss

---

## 7. Open Questions for Approval

1. **Confirm**: Should I apply the 4 RLS policies for the `chapters` table via Supabase MCP?
2. **Confirm**: The friend will create `client/.env` with the provided credentials — do you want me to generate the exact file content?
3. **Confirm**: No other code changes are needed — the authentication flow, API routes, and storage are already correctly implemented for multi-user shared project usage?

---

## 8. Plan Summary

**Priority 1 (Fix Auth)**: Friend creates `client/.env` with shared Supabase credentials → clears browser storage → fresh Google OAuth login

**Priority 2 (Fix Chapters Access)**: Apply 4 RLS policies to `chapters` table so frontend (anon key) can read/write own chapters

**Priority 3 (Verify)**: Run through test checklist — all operations should work with friend's independent Google account, storing data in shared database/bucket

**No code changes to frontend or backend source files required** — this is purely configuration + database policy + session reset.