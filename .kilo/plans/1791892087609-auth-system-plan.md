# Ekithab AI: Audiobook – Supabase Auth Integration Plan

## 1. Overview
This plan outlines the steps to add a complete authentication flow to the existing Vite + React audiobook application using Supabase Auth (email/password and Google OAuth). It keeps existing audiobook features intact, introduces a minimal routing mechanism, and ensures secure session handling.

## 2. Current Frontend Architecture
- **Root**: `src/App.jsx` renders audiobook UI.
- **Routing**: None; UI is conditionally rendered.
- **Services**: API wrapped via Axios (no Supabase client).
- **Styling**: Tailwind + custom components.

## 3. Proposed Frontend Additions
| File | Purpose |
|------|---------|
| `src/lib/supabaseClient.ts` | Singleton Supabase client initialized with VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.
| `src/context/AuthContext.tsx` | React context that provides **session**, **signIn**, **signUp**, **signOut**, and **authChange** callbacks.
| `src/pages/Login.jsx` | Email/password login form + Google button.
| `src/pages/Register.jsx` | Email/password registration form with email‑verification instruction.
| `src/pages/Dashboard.jsx` | Wrapper that renders the audiobook app; only accessible when authenticated.
| `src/App.jsx` | Updated to use `AuthProvider` and a basic router (switch on URL path).
| `src/components/Button.jsx` | Existing button reused; add variant styles.

## 4. Route Design
- `/login` → `Login.jsx`
- `/register` → `Register.jsx`
- `/` (or `/dashboard`) → `Dashboard.jsx` (protected)

Simple manual routing (using `window.location.pathname` and `history.pushState`) avoids adding a heavy router dependency.

## 5. Authentication Flow
1. **Session Restore** – On mount, call `supabase.auth.getSession()` and set state.
2. **Auth State Listener** – Subscribe to `supabase.auth.onAuthStateChange` to sync.
3. **Login** – POST `/auth/v1/token?grant_type=password` via Supabase client.
4. **Register** – POST `/auth/v1/signup`.
5. **Google OAuth** – Redirect to `/auth/v1/authorize?provider=google&redirect_to=<base_url>/auth/callback`.
6. **Callback** – Parse session params from URL, call `supabase.auth.getSession()`.
7. **Token Persistence** – Supabase client stores tokens in `localStorage` automatically.
8. **Logout** – Call `supabase.auth.signOut()`; clear session.

## 6. UI Requirements
All pages follow brand guidelines (ivory/white background, lavender accents). Use existing Tailwind classes. Forms include:
- Email, Password (and confirmation) fields.
- Submit button (disabled while loading).
- Success/error toast messages.
- Loader spinner on network calls.
- “Continue with Google” button using Google icon from Lucide.

## 7. Validation & Error Handling
- Client-side email regex and password length check (>=8).
- Show API error messages but avoid leaking sensitive info.
- Handle email‑verification status and display a prompt for user to check inbox.
- Manage session expiration via Supabase session refresh.

## 8. Row‑Level Security & Permissions (Verification)
The existing Supabase schema is not modified. Row‑level policies on user‑specific resources are **assumed** to exist; if needed, the developer can verify RLS for tables used by the app (e.g., `books`, `chapters`). No changes to RLS are part of the plan.

## 9. Compatibility with Audiobook Features
- The `App.jsx` logic remains untouched; it is moved into `Dashboard.jsx` which is rendered only after authentication.
- No API changes; session token automatically attached by Supabase client via `axios.defaults.withCredentials` is not needed because Supabase auth uses a `supabaseAuthUrl` cookie. Ensure API calls include the `@supabase/supabase-js` SDK to forward the access token.
- Local state for user’s book remains the same.

## 10. Testing & Verification Strategy
1. **Manual Test** – Verify register, login, email verification, Google OAuth, logout, session persistence, and redirect logic.
2. **Unit Tests** – Add Jest tests (if test framework exists) for AuthContext helpers.
3. **Integration** – Use Cypress to simulate user flow; not part of plan but recommended.
4. **Lint/Type‑check** – Run `yarn lint` / `yarn typecheck` after implementing.

## 11. Implementation Sequence (Phases)
1. **Supabase Client** – Add dependency, initialize in `supabaseClient.ts`.
2. **Auth Context** – Build context, session provider, and hooks.
3. **Routing Helper** – Minimal router.
4. **Auth Pages** – Login, Register, Callback.
5. **Protected Dashboard** – Render existing app.
6. **Logout Button** – Add to `TopBar.jsx`.
7. **Styling & UX** – Align with brand colors.
8. **Update `package.json`** – Add `@supabase/supabase-js`.
9. **Run Lint** – Ensure no errors.

## 12. Risks & Mitigations
- **Missing Dependency** – If npm install not allowed, team must manually install `@supabase/supabase-js`.
- **Redirect URI** – Ensure Supabase console allows `http://localhost:5175/auth/callback`.
- **State Overflow** – Guard against memory leaks by cleaning listeners on unmount.
- **Cross‑Domain Cookies** – Supabase uses same‑origin cookies; localhost domain matches.

## 13. Acceptance Checklist
- [ ] Email sign‑up shows verification email prompt.
- [ ] Email login works with password.
- [ ] Google OAuth works and redirects correctly.
- [ ] Auth session persists across page reloads.
- [ ] Unauthenticated users cannot access dashboard.
- [ ] Authenticated users are redirected away from login/register.
- [ ] Logout clears session and redirects to login.
- [ ] All UI matches brand guidelines.
- [ ] No secrets exposed.
- [ ] Lint and type‑check pass.

**Prepared by**: Kilo Lead
**Date**: 2026-10-13
