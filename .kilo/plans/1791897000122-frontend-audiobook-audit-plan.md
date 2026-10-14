# Ekithab AI: Audiobook — Frontend Audit & Implementation Plan

**Project Root:** `/Users/vamshikrishna/vernacular-audiobook`  
**Client Directory:** `/Users/vamshikrishna/vernacular-audiobook/client`  
**App URL:** http://localhost:5175  
**Date:** 2026-10-13

---

## 1. Executive Summary

The frontend is a React 18 + TypeScript + Vite SPA with Supabase Auth and a custom Node.js backend (port 4001). The production build succeeds (506 KB bundle), but the browser renders a blank page due to a **confirmed critical bug in `AuthContext.tsx`**: incorrect destructuring of `supabase.auth.onAuthStateChange()` return value causes `subscription.unsubscribe()` to fail with `Cannot read properties of undefined (reading 'unsubscribe')`.

Beyond this blocker, the audit identified:
- **5 confirmed bugs** (P0–P1)
- **6 likely bugs** requiring runtime verification (P1–P2)
- **4 configuration items** requiring manual verification
- **3 warnings/optimizations** (P3)
- Several areas that appear healthy

The application architecture is sound: single Supabase client, clear component hierarchy, functional audiobook features (upload, chapter splitting, synthesis, read-along playback). No security issues found in frontend code (no secrets, no service-role keys).

---

## 2. Confirmed Blank-Page Root Cause

**File:** `client/src/context/AuthContext.tsx:20`

**Code:**
```tsx
const { subscription } = supabase.auth.onAuthStateChange(
  async (_event, newSession) => { ... }
);
```

**Actual Return Type (from `@supabase/auth-js` v2.39.0):**
```ts
{ data: { subscription: Subscription } }
```

**Bug:** Destructuring expects `{ subscription }` but receives `{ data: { subscription } }`. The `subscription` variable is `undefined`, so cleanup at line 27 (`subscription.unsubscribe()`) throws.

**Effect:** React Strict Mode mounts → unmounts → remounts. First mount: effect runs, `subscription` is `undefined`. Cleanup runs immediately (Strict Mode), tries `undefined.unsubscribe()` → **uncaught TypeError** → React unmounts entire tree → **blank page**.

**Minimal Fix:**
```tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
```

---

## 3. Other Confirmed Bugs

| ID | Severity | File | Line | Issue |
|----|----------|------|------|-------|
| BUG-001 | P0 | `AuthContext.tsx` | 13–17 | `initialize()` async function not awaited; `setLoading(false)` executes before `getSession()` resolves. Loading state clears prematurely. |
| BUG-002 | P0 | `AuthContext.tsx` | 20–24 | Auth state callback ignores `event` type. Does not handle `INITIAL_SESSION`, `SIGNED_OUT`, `TOKEN_REFRESHED` distinctly. Relies only on `newSession` null check. |
| BUG-003 | P1 | `App.jsx` | 22 | `if (loading) return null;` renders nothing during auth initialization — no spinner, no fallback. Combined with BUG-001, user sees blank page briefly. |
| BUG-004 | P1 | `AuthContext.tsx` | 44–47 | `signOut()` calls `setSession(null)` before `supabase.auth.signOut()` resolves. Race condition if signOut fails. |
| BUG-005 | P1 | `useAudioPlayer.jsx` | 55 | Effect dependency `[audioUrl]` only. `alignment` used inside effect (line 21, 30) but not in deps. Stale closure risk if `alignment` changes mid-playback. |

---

## 4. Potential Bugs Requiring Runtime Verification

| ID | Severity | File | Issue | Verification Needed |
|----|----------|------|-------|---------------------|
| SUSP-001 | P1 | `AuthContext.tsx` + `App.jsx` | Redirect logic in `App.jsx` may cause redirect loops if `loading` flickers or `session` updates asynchronously. | Test: login → refresh → logout → login flows in browser. |
| SUSP-002 | P1 | `Dashboard.jsx:40–48` | `loadChapterAudio` swallows 404 errors silently (`catch { }`). If backend returns non-404 error, no user feedback. | Test: generate audio, then corrupt backend response. |
| SUSP-003 | P1 | `Dashboard.jsx:84–97` | `synthesizeAudio` error handling assumes `err.response?.data?.error`. If network error or non-JSON response, `err.response` is undefined → `setError('Failed to generate audio')` loses detail. | Test: disconnect backend, trigger generate. |
| SUSP-004 | P2 | `VoiceSelector.jsx:22–27` | `getVoices()` called once on mount with empty dependency array. If language changes, voices not re-fetched (client-side filtering only). Works if backend returns all voices; fails if backend filters by language. | Verify: backend `/api/voices` returns all languages or requires `?language=` param. |
| SUSP-005 | P2 | `BookUploader.jsx:22–27` | Server-side PDF/EPUB parsing: `uploadDocument` sends file, expects `{ title, chapters }` response. No validation of response shape. | Test: upload PDF, verify response parsing. |
| SUSP-006 | P2 | `api.js:16` | `Idempotency-Key` uses `crypto.randomUUID()`. Not available in older browsers (Safari <15.4, Firefox <110). Polyfill needed if supporting legacy. | Check browser support matrix; test in target browsers. |

---

## 5. Configuration Items Requiring Manual Verification

| ID | Item | Location | Action Required |
|----|------|----------|-----------------|
| CFG-001 | Supabase OAuth Redirect URL | Supabase Dashboard → Authentication → URL Configuration | Verify `http://localhost:5175` (dev) and production URL are in **Site URL** and **Redirect URLs**. Google OAuth callback must match. |
| CFG-002 | Google Cloud OAuth Consent Screen | Google Cloud Console → APIs & Services → OAuth Consent Screen | Verify authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Test Google sign-in end-to-end. |
| CFG-003 | Supabase Email Confirmation | Supabase Dashboard → Authentication → Providers → Email | Confirm whether email confirmation is **enabled** (default) or disabled. If enabled, registration flow must handle unconfirmed state. |
| CFG-004 | Backend CORS | Backend (port 4001) | Verify backend allows `Origin: http://localhost:5175` with credentials. Test: `fetch('http://localhost:4001/health', { credentials: 'include' })`. |

---

## 6. Build/Test Results

| Check | Status | Details |
|-------|--------|---------|
| `npm run build` | ✅ Success | 506 KB JS bundle (warns >500 KB) |
| `npm run typecheck` | ❌ Not runnable | No `tsconfig.json` in `client/` |
| Linting | ❌ Not configured | No ESLint/Prettier config |
| Unit tests | ⚠️ Partial | Only `chapterSplitter.selfcheck.mjs` (manual Node script) |
| Component/E2E tests | ❌ None | No Vitest, Playwright, or Cypress configured |

**Bundle Size Note:** 506 KB is a performance warning, not the blank-page cause. Main contributors: `@supabase/supabase-js`, `@radix-ui/*`, `lucide-react`. Optimization: code-split heavy pages (Dashboard), lazy-load `VoiceSelector`, consider `@supabase/supabase-js` tree-shaking.

---

## 7. Prioritized Issue Table

| ID | Severity | Category | File | Fix Summary |
|----|----------|----------|------|-------------|
| BUG-001 | P0 | Auth | `AuthContext.tsx` | Await `initialize()`; move `setLoading(false)` after `getSession()` resolves. |
| BUG-002 | P0 | Auth | `AuthContext.tsx` | Fix destructuring: `const { data: { subscription } } = ...`; handle `event` types explicitly. |
| BUG-003 | P1 | UX | `App.jsx` | Replace `return null` with loading spinner/skeleton during auth init. |
| BUG-004 | P1 | Auth | `AuthContext.tsx` | `signOut`: await `supabase.auth.signOut()` then `setSession(null)`. |
| BUG-005 | P1 | Audio | `useAudioPlayer.jsx` | Add `alignment` to effect deps; use refs for alignment if mid-playback updates needed. |
| SUSP-001 | P1 | Routing | `App.jsx` | Add transition guard: only redirect after `loading === false` stable. |
| SUSP-002 | P1 | API | `Dashboard.jsx` | Surface non-404 errors in `loadChapterAudio`; add toast/notification. |
| SUSP-003 | P1 | API | `Dashboard.jsx` | Guard `err.response` in `synthesizeAudio` catch; show network error if absent. |
| SUSP-004 | P2 | Voices | `VoiceSelector.jsx` | Add `language` to `useEffect` deps; re-fetch if backend filters. |
| SUSP-005 | P2 | Upload | `BookUploader.jsx` | Validate server response shape; handle malformed responses. |
| SUSP-006 | P2 | Compat | `api.js` | Add `crypto.randomUUID` polyfill or fallback for older browsers. |
| CFG-001–004 | P1 | Config | External | Manual verification in Supabase/Google Cloud/Backend. |
| OPT-001 | P3 | Perf | `vite.config.js` | Add manual chunks for `@supabase/*`, `@radix-ui/*`, `lucide-react`. |
| OPT-002 | P3 | Types | `client/` | Add `tsconfig.json`; enable `npm run typecheck`. |
| OPT-003 | P3 | Test | `client/test/` | Add Vitest + React Testing Library; migrate `chapterSplitter` test; add auth/context tests. |

---

## 8. Proposed Implementation Sequence

### Phase A — Fix Blank Page (P0 Auth)
1. **Fix `AuthContext.tsx` destructuring** (BUG-002) — enables app to run.
2. **Fix `initialize()` await/loading** (BUG-001) — correct loading state.
3. **Fix `signOut` race** (BUG-004) — await signOut before clearing session.
4. **Add loading UI in `App.jsx`** (BUG-003) — spinner instead of `null`.

### Phase B — Stabilize Auth & Routing (P1)
5. **Enhance auth callback** (BUG-002 cont.) — handle `INITIAL_SESSION`, `SIGNED_OUT`, `TOKEN_REFRESHED`.
6. **Guard redirects in `App.jsx`** (SUSP-001) — only redirect when `loading === false`.
7. **Verify CFG-001–004** — manual checks; document results.

### Phase C — Harden API & Audio (P1–P2)
8. **Fix `useAudioPlayer` alignment dep** (BUG-005) — add `alignment` to deps; use ref for live alignment.
9. **Improve `loadChapterAudio` errors** (SUSP-002) — surface non-404.
10. **Guard `err.response` in synthesis** (SUSP-003) — network error fallback.
11. **Fix `VoiceSelector` language dep** (SUSP-004) — re-fetch on language change.
12. **Validate upload response** (SUSP-005) — schema check.

### Phase D — Compatibility & Polish (P2–P3)
13. **Add `crypto.randomUUID` polyfill** (SUSP-006) — or use `uuid` package.
14. **Add `tsconfig.json` + typecheck** (OPT-002) — catch type errors early.
15. **Add Vitest + basic tests** (OPT-003) — auth context, chapter splitter, audio hook.
16. **Bundle optimization** (OPT-001) — manual chunks, lazy load Dashboard.

---

## 9. Exact Files Expected to Change

| File | Changes |
|------|---------|
| `client/src/context/AuthContext.tsx` | Fix destructuring; await `initialize()`; handle auth events; fix `signOut`; add error state. |
| `client/src/App.jsx` | Loading spinner; guard redirects with `loading === false`. |
| `client/src/hooks/useAudioPlayer.jsx` | Add `alignment` to effect deps; use `useRef` for live alignment. |
| `client/src/pages/Dashboard.jsx` | Error handling in `loadChapterAudio`, `synthesizeAudio`, `generateAll`. |
| `client/src/components/studio/VoiceSelector.jsx` | Add `language` to `useEffect` deps; re-fetch voices. |
| `client/src/components/studio/BookUploader.jsx` | Validate server response shape. |
| `client/src/services/api.js` | `crypto.randomUUID` polyfill/fallback. |
| `client/vite.config.js` | (Optional) Manual chunks for bundle splitting. |
| `client/tsconfig.json` | **New file** — TypeScript config for typecheck. |
| `client/test/` | **New files** — Vitest setup, component tests. |

**No changes outside `client/`.** Backend, Supabase config, database, and root config are out of scope.

---

## 10. Browser Verification Checklist

After each phase, verify in browser (http://localhost:5175):

### Phase A (Blank Page Fix)
- [ ] App loads without console errors
- [ ] Login page renders
- [ ] Register page renders
- [ ] No `unsubscribe` TypeError in console

### Phase B (Auth & Routing)
- [ ] Register → email/password → redirects to Dashboard
- [ ] Login → valid creds → redirects to Dashboard
- [ ] Login → invalid creds → shows error, stays on Login
- [ ] Refresh on Dashboard → stays logged in (session persists)
- [ ] Logout → redirects to Login
- [ ] Google OAuth → redirects to Google → returns → Dashboard (requires CFG-001, CFG-002)
- [ ] Direct navigation to `/dashboard` when logged out → redirects to Login
- [ ] Direct navigation to `/login` when logged in → redirects to Dashboard

### Phase C (Audio & API)
- [ ] Upload `.txt`/`.md` → chapters parsed → Dashboard shows book
- [ ] Upload `.pdf`/`.epub` → server parses → chapters loaded (requires backend)
- [ ] Generate audio for chapter → audio plays, read-along highlights
- [ ] Playback controls: play, pause, seek, speed, sentence skip
- [ ] Chapter switch → loads/generates audio correctly
- [ ] Bulk generate → status shown, no silent failures
- [ ] Network disconnect → user-facing error (not console-only)

### Phase D (Compatibility & Types)
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (new tests)
- [ ] `npm run build` succeeds, bundle < 500 KB (or documented)
- [ ] Test in Safari/Firefox (polyfill check)

---

## 11. Risks & Unresolved Questions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google OAuth not configured (CFG-001, CFG-002) | Google sign-in fails silently or redirects to wrong URL | Manual verification required before Phase B complete. |
| Backend not running / CORS misconfigured | All API calls fail; audiobook features unusable | Test `/health` endpoint; verify CORS in backend. |
| Supabase email confirmation enabled (CFG-003) | New users stuck in "unconfirmed" state; no UI for resend | Check Supabase dashboard; add resend confirmation UI if needed. |
| `crypto.randomUUID` polyfill missing | Older browsers crash on synthesis | Add polyfill early (Phase D step 13). |
| No TypeScript config | Type errors undetected; refactoring risk | Add `tsconfig.json` before Phase D. |
| No error boundary | Any component crash → blank page | Consider adding `<ErrorBoundary>` in `main.jsx` (low priority). |
| `useAudioPlayer` stale alignment | Read-along highlights wrong sentence after chapter switch | Fixed in Phase C step 8 (alignment ref). |

**Unresolved Questions:**
1. Does backend `/api/voices` require `language` query param or return all? (Affects SUSP-004 fix)
2. What is the exact response shape for `/api/documents/upload` on PDF/EPUB? (Affects SUSP-005 fix)
3. Is Supabase email confirmation enabled? (Affects registration UX)
4. Target browser support matrix? (Determines polyfill necessity)

---

## Next Steps

**Awaiting your approval to proceed with implementation.** The plan is ordered to fix the blank page first (Phase A), then stabilize core auth/audio (Phases B–C), then add tooling/polish (Phase D). Each phase is independently verifiable in the browser.

To proceed, confirm:
1. Approve the plan as written, or
2. Request modifications to priority/scope, or
3. Provide answers to unresolved questions (CFG-001–004, backend API shapes).