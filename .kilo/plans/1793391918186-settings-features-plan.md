# Settings Features Implementation Plan

## Goal
Extend the Settings page to support:
- Multi-account switching via a recent-account list
- Backend-synced language preference
- Hard account deletion (cascade delete + auth user removal)
- Logout that clears all app-scoped localStorage keys and terminates the Supabase session

## Decisions (confirmed with user)
- **Account switching**: recent-account list (localStorage-stored emails only, no tokens; max 5).
- **Language storage**: auth.user.user_metadata via `PUT /api/settings/preferences` (no DB migration).
- **Deletion**: hard delete — explicitly cascade-delete child rows then remove auth user.
- **Logout scope**: clear all known `ekithab-*` localStorage keys + Supabase signOut.

## Affected Files
| File | Change |
|---|---|
| `server/src/routes/settingsRoutes.js` | Add `PUT /preferences` and `DELETE /account` |
| `client/src/services/api.js` | Add `updatePreferences()`, `deleteAccount()` |
| `client/src/components/settings/PreferencesTab.jsx` | Read/write language from backend; keep localStorage fallback |
| `client/src/components/settings/AccountTab.jsx` | Add logout button + recent-account switcher UI |
| `client/src/pages/AuthPage.jsx` | Pre-fill email from `ekithab-pending-email` on mount |
| `client/src/context/AuthContext.tsx` | (optional) expose `onSignedOut` callback; or handle locally in AccountTab |

## Task List

### 1. Backend — PUT /api/settings/preferences
Add to `settingsRoutes.js`:
- Accept `{ language }` (required, one of the 10 supported codes from `PreferencesTab.LABELS`).
- Validate: reject 400 if missing or unsupported.
- Persist to auth user metadata: `supabase.auth.admin.updateUserById(userId, { data: { preferred_language: language } })`.
- Return `{ success: true, language }`.
- Mirror existing pattern used by `PUT /profile`.

### 2. Backend — DELETE /api/settings/account
Add to `settingsRoutes.js`:
- Delete rows in FK-safe order (service_role bypasses RLS):
  1. `downloads` WHERE user_id = userId
  2. `credit_transactions` WHERE user_id = userId
  3. `audio_generations` WHERE user_id = userId
  4. `chapters` WHERE user_id = userId
  5. `books` WHERE user_id = userId
  6. `users` WHERE id = userId
- Then call `supabase.auth.admin.deleteUser(userId)`.
- Return `{ success: true }` on completion, 500 on any error.
- Ensure the operation is atomic-ish: wrap in try/catch; on partial failure, log and return error (admin console cleanup may be needed if auth user deleted but public rows remain — note as a risk).

### 3. Client — new API helpers
In `api.js`:
```js
export function updatePreferences({ language }) {
  return api.put('/api/settings/preferences', { language }).then(res => res.data);
}
export function deleteAccount() {
  return api.delete('/api/settings/account').then(res => res.data);
}
```

### 4. Client — recent-account list utility
Create `client/src/utils/recentAccounts.js` (ponytail: tiny module):
- `getRecentAccounts()` → returns array of `{ email, displayName }`.
- `pushRecentAccount(email, displayName?)` → appends unique entry, trims to 5, persists to `localStorage.ekithab-recent-accounts`.
- `clearRecentAccounts()` → removes the key.
- Integrate calls into `AuthContext.tsx`'s `signIn`, `signUp`, and `signInWithGoogle` callbacks (read email / metadata from the returned session).

### 5. Client — AccountTab updates
In `AccountTab.jsx`:
- **Logout section** (after Security section or before Delete account):
  - Button "Log out".
  - On click: call `signOut()`, then iterate `Object.keys(localStorage)` and remove any key starting with `ekithab-`, then navigate to `/`.
- **Switch account section** (new, below profile info or above Security):
  - Fetch recent accounts via the utility.
  - If none: show subtle "No other accounts" text.
  - If some: render a list of clickable chips/cards showing email + initials. Clicking navigates to `/auth?email=<encoded>` (or writes to `ekithab-pending-email` and navigates).
  - Exclude the currently logged-in user's email.
  - Include a small "Clear history" link to wipe the list.

### 6. Client — AuthPage pre-fill
In `AuthPage.jsx`:
- On mount, read `localStorage.getItem('ekithab-pending-email')`.
- If present, set `email` state and remove the key.
- Optional: also read a `mode` param to default to signin vs signup.
- This enables the recent-account switcher to resume sign-in flow seamlessly.

### 7. Client — PreferencesTab sync
In `PreferencesTab.jsx`:
- On mount, read preferred language with priority:
  1. `session.user.user_metadata?.preferred_language`
  2. `localStorage.ekithab-preferences` (existing)
  3. `'hi-IN'` (existing default)
- On change: call `updatePreferences({ language: val })` and also update localStorage as fallback.
- Show a "Synced" or "Saved" indicator on success.
- Keep the dropdown disabled while a request is in flight.

## Data Flow Highlights
- **Language**: Settings → API (PUT /preferences) → Supabase auth metadata → next session reads from metadata.
- **Delete**: Settings → API (DELETE /account) → server deletes child rows → server deletes auth user → client clears state + navigates to `/`.
- **Switch**: Settings reads `ekithab-recent-accounts` → click → write pending email → navigate to `/auth` → AuthPage pre-fills.

## Risks & Mitigations
1. **Partial delete failure**: If `auth.admin.deleteUser` succeeds but a child table delete fails (or vice versa), data could be orphaned.
   - *Mitigation*: delete child tables first, then auth user. Log clearly. In production, a follow-up admin query can clean up orphans.
2. **RLS on child tables**: service_role bypasses RLS by default, but verify no policy explicitly blocks service_role deletes. Existing code already deletes books/chapters via service role without issues.
3. **Recent accounts stale**: emails remain after the account is deleted.
   - *Mitigation*: accept this minor inconsistency; the user will hit a sign-in error and can clear the list manually via the "Clear history" link.
4. **Supabase metadata limits**: auth user metadata has a 2KB limit. `preferred_language` is tiny, so safe.

## Validation
- Run `npm run typecheck` in the client workspace.
- Run `npm run lint` in the server workspace.
- Manual smoke tests:
  1. Open Settings → Preferences → change language → reload → language persists and is restored.
  2. Open Settings → Account → click "Log out" → verify localStorage keys are cleared and page lands on `/`.
  3. Sign in as user A → open Settings → click a recent account B → lands on `/auth` with B's email pre-filled.
  4. Call `DELETE /api/settings/account` (via curl or UI) → verify rows are gone from all four tables and auth user no longer exists.

## Out of Scope (explicitly deferred)
- Soft-delete / archive flow
- Server-side session revocation beyond Supabase signOut
- Cross-device account switching (would require server-side token storage)
- Password reset improvements (already exists)
- ConnectedDevicesCard real device tracking (currently UA-parsed only)
