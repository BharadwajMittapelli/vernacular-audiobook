# Plan: Fix Invalid or Expired Token During Book Upload

## 1. Root Cause Analysis

### Investigation Findings & Trace
1. **Frontend Session & Request Creation**:
   - User signs in via Google OAuth (`AuthContext.tsx:119`). Supabase handles token persistence in `localStorage`.
   - On document upload (`BookUploader.jsx`), for `.pdf` / `.epub` / `.docx` files, `uploadDocument(file, language)` calls `api.post('/api/documents/upload')`.
   - The Axios request interceptor (`api.js:41-51`) calls `getValidSession()` which returns the current Supabase `access_token`.
   - Axios sets `Authorization: Bearer <access_token>` on the POST request to `http://localhost:4001/api/documents/upload`.

2. **Backend Route Definition vs Auth Middleware**:
   - In `server/src/index.js:98`:
     `app.use('/api/documents', documentRouter);`
     Notice that `documentRouter` is mounted **WITHOUT** `authMiddleware`!
   - In `server/src/routes/documentRoutes.js:102`:
     `POST /upload` parses the document statelessly and returns `{ title, chapters, language }`.
   - In `BookUploader.jsx:60`:
     `uploadDocument` returns `{ title, chapters }` to `BookUploader.jsx` which invokes `onDocumentLoaded({ title, chapters })`.
   - In `MyBooks.jsx:230-244`:
     `handleDocumentLoaded` calls `createBook({ title, chapters })` which calls `api.post('/api/studio', { title, chapters })`.
   - In `server/src/index.js:101`:
     `app.use('/api/studio', authMiddleware, studioRoutes);`
     `POST /api/studio` IS protected by `authMiddleware`!

3. **Backend Auth Middleware Execution (`server/src/middleware/auth.js`)**:
   - `authMiddleware` receives `Authorization: Bearer <user_access_token>`.
   - It calls `supabase.auth.getUser(token)` using `supabase` initialized in `server/src/config/supabase.js`.
   - In `server/src/config/supabase.js`:
     ```js
     export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
       auth: { autoRefreshToken: false, persistSession: false },
     });
     ```
   - `supabase.auth.getUser(token)` validates the JWT using the project's JWT secret/public key via the Supabase Auth API endpoint.
   - If `getUser(token)` succeeds, `authMiddleware` attempts to upsert the user into `public.users`:
     ```js
     const { error: upsertError } = await supabase
       .from('users')
       .upsert(
         { id: user.id, email: user.email, credits: 500 },
         { onConflict: 'id', ignoreDuplicates: true }
       );
     ```
   - If `upsertError` occurs, `authMiddleware` returns `500 Failed to provision user`.
   - If `getUser(token)` fails (`error || !user`), `authMiddleware` returns `401 Invalid or expired token`.

4. **Why the Error Occurred on Friend's Computer**:
   - **Scenario A (Most likely - Environment Variable & Process Restart)**:
     When your friend switched `.env` to point to your Supabase project, if Vite (frontend dev server) or Node (backend dev server) was not restarted, or if Vite was still using a cached build / stale `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `client/.env`, the frontend generated access tokens for the *old* Supabase project. When sent to the updated backend (which validates against your Supabase project URL), `supabase.auth.getUser(token)` returns invalid JWT / user not found, causing `401 Invalid or expired token`.
   - **Scenario B (Expired local session in browser storage)**:
     Your friend's browser `localStorage` retained a cached session token from the old Supabase project from before the `.env` update. Simply clicking "upload" uses the cached token until the user explicitly signs out and logs in again via Google OAuth under the new project credentials.
   - **Scenario C (Upsert failure during middleware provision)**:
     If `public.users` upsert threw an unhandled error or schema mismatch, though `auth.js` returns `500 Failed to provision user` in that specific case, any uncaught error in `getUser` block returns `401 Invalid or expired token`.

## 2. Identified Root Cause & Affected Files

- **Primary Root Cause**: Frontend and/or Backend environment mismatch or stale session token stored in browser local storage from previous Supabase project configuration prior to backend environment sync. Token issued by old project fails validation at `supabase.auth.getUser(token)` in `server/src/middleware/auth.js`.
- **Secondary Code Resiliency Issue**: In `server/src/middleware/auth.js`, if token validation fails, the catch block logs `authMiddleware error: <msg>` but does not log detailed JWT validation failure context (such as issuer mismatch), making debugging non-transparent.

- **Files Responsible**:
  1. `server/src/middleware/auth.js` — Auth middleware token validation and debug logging.
  2. Frontend browser session (requires user log out and log back in to clear old Supabase JWT).

## 3. Minimal Proposed Fix

1. **Verify Environment Configurations**:
   - Ensure `client/.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` matching `server/.env` `SUPABASE_URL`.
2. **Enhance Auth Middleware Error Logging (`server/src/middleware/auth.js`)**:
   - Add minimal diagnostic logging to `server/src/middleware/auth.js` when `getUser(token)` returns an error in non-production environments, so that if a token is rejected, the exact Supabase auth error message (e.g. `invalid JWT` or `user not found`) is output to server logs.
3. **User Action / Verification Protocol**:
   - Friend must clear browser local storage / sign out and log back in using Google Auth on the updated project URL.

## 4. Verification & Testing Plan

1. **Authentication Flow Verification**:
   - Friend logs out and logs in via Google Auth.
   - Verify JWT issuer matches `https://sgpkxgwnxusjagjnesir.supabase.co`.
2. **Upload Test**:
   - Friend uploads a small `.txt` or `.pdf` file from the My Books modal.
   - Confirm `POST /api/studio` accepts the token without `Invalid or expired token` error.
   - Confirm book is created with `user_id` matching friend's Supabase Auth user ID (`12aa92f3-9636-4ab3-921a-bda635069222`).
