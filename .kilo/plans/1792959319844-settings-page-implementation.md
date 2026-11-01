# Settings Page — Implementation Plan

## Overview

Implement a functional Settings page at `/settings` with a three-column layout (settings nav · content · account overview). Integrate with existing auth, navigation, and data layer. No account deletion. Password recovery uses Supabase email flow.

**Saved plan**: `.kilo/plans/1792959319844-settings-page-implementation.md` (previous revision — superseded by this one)

---

## 1. Files to Create

```
client/src/pages/Settings.jsx                         # Main page shell + routing
client/src/pages/UpdatePassword.jsx                   # Password reset completion page
client/src/components/settings/SettingsTopBar.jsx     # Top bar: search, bell, avatar, sign-out
client/src/components/settings/SettingsNav.jsx        # Left vertical nav (5 tabs)
client/src/components/settings/AccountTab.jsx         # Profile + security + delete zone
client/src/components/settings/PreferencesTab.jsx     # Language preference
client/src/components/settings/PlaybackTab.jsx        # Default speed + voice
client/src/components/settings/CreditsTab.jsx         # Credits balance + usage summary
client/src/components/settings/NotificationsTab.jsx   # Email notification toggle
client/src/components/settings/AccountOverviewCard.jsx# Right panel: plan + stats
client/src/components/settings/ConnectedDevicesCard.jsx# Right panel: current device
client/src/components/settings/DangerZoneCard.jsx     # Right panel: delete (deferred)
server/src/routes/settingsRoutes.js                   # Backend: GET /stats, PUT /profile
```

## 2. Files to Modify

```
client/src/App.jsx                                      # Add /settings route case
client/src/components/layout/Sidebar.jsx               # Enable Settings nav (route: '/settings')
client/src/components/books/MyBooksSidebar.jsx         # Enable Settings nav (route: '/settings')
client/src/services/api.js                             # Add getSettingsStats(), updateProfile()
server/src/index.js                                    # Mount settings router
```

## 3. Existing Components / APIs Reused

| Reused | Where |
|--------|-------|
| `useAuth()` / `session.user` | All profile data, sign-out |
| `useNavigate()` from `NavigateContext` | Navigation away from Settings |
| `Button` component | All buttons |
| `supabase` client (client-side) | Password reset (`resetPasswordForEmail`), `onAuthStateChange` for `PASSWORD_RECOVERY` |
| `VoiceSelector` + `Slider` | Playback tab (same props, same `getVoices` API) |
| `lucide-react` icons | All icons (already installed) |
| `cn()` utility | Class merging |
| `LABELS` map | Language names — extract once to a shared constant in `Settings.jsx` or a small module |

**Not modified**: `TopBar.jsx`, `MainLayout.jsx`, `Dashboard.jsx`, `MyBooks.jsx`, `AuthContext.tsx`, any server route other than the new `settingsRoutes.js`.

---

## 4. Navigation & Routing

### App.jsx change
Add one `case` to the existing `switch (path)` block (after `/my-books`):

```jsx
case '/settings':
  return (
    <NavigateContext.Provider value={navigate}>
      <Settings />
    </NavigateContext.Provider>
  );
```

The existing auth guard effect already redirects unauthenticated users from `/settings` to `/login`. No change needed there.

### Sidebar changes (both files)
In **both** `Sidebar.jsx` and `MyBooksSidebar.jsx`, change the Settings nav item:

```js
// Before:
{ label: 'Settings', icon: Settings, route: '#', active: false },
// After:
{ label: 'Settings', icon: Settings, route: '/settings' },
```

In `Sidebar.jsx`, also remove the `if (!isRoute) return;` early-exit so the Settings click falls through to `onNavClick?.('/settings')`. The existing logic `const isRoute = item.route && item.route !== '#';` already handles this correctly after the route change.

### Settings page internal navigation
Tab switching uses **React state only** (`useState('account')`). No `navigate()` calls, no URL changes, no `popstate` events. The browser Back/Forward buttons only navigate between pages (Studio ↔ My Books ↔ Settings), not between settings tabs.

### UpdatePassword page
New route at `/update-password`. `App.jsx` switch case:
```jsx
case '/update-password':
  return (
    <NavigateContext.Provider value={navigate}>
      <UpdatePassword />
    </NavigateContext.Provider>
  );
```

This page is the `redirectTo` target for password recovery. It reads `?type=recovery&token=` from the URL, shows a password form, and calls `supabase.auth.updateUser({ password })` on submit.

---

## 5. Layout

### Desktop (≥ 1024px)
Three columns inside the main content area (full width minus global sidebar):

```
┌─────────────────────────────────────────────────────────────────┐
│ Global Sidebar │ Settings Nav │     Content Area      │ Overview│
│   w-64 (fixed) │  w-60        │     flex-1 min-w-0    │ w-72    │
└─────────────────────────────────────────────────────────────────┘
```

```jsx
<div className="flex h-screen overflow-hidden bg-background">
  {/* Global sidebar is rendered by SettingsNav wrapper or directly in Settings.jsx */}
  <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
    <SettingsTopBar />
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-serif font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account, preferences, and audio settings.
        </p>
        <div className="mt-8 flex gap-6">
          <SettingsNav activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 min-w-0">{/* Tab content */}</div>
          <div className="w-72 shrink-0 space-y-4">
            <AccountOverviewCard />
            <ConnectedDevicesCard />
            <DangerZoneCard />
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
```

**Total content width check**: `240px (nav) + flex-1 + 288px (overview) + 24px (gap)`. At 1280px viewport minus 256px sidebar = 1024px available. 240 + 288 + 24 = 552px used, leaving ~472px for content. No overflow.

### Responsive (< 1024px)
Stack vertically: nav as horizontal scrollable row, content full-width, cards below.

### Responsive (< 768px)
Single column, full-width cards.

---

## 6. Five Tabs — Functional Behavior

### Tab: Account (default)

**Profile information**
- **Name**: `<input>` pre-filled from `session.user.user_metadata.full_name`. Save/Cancel buttons. On Save: `PUT /api/settings/profile { full_name }`. On success: show green banner "Profile updated", refresh session via `supabase.auth.getSession()`. On cancel: revert to original value.
- **Email**: `<input>` pre-filled from `session.user.email`, `disabled`, gray background. Below it: small text "To change your email, contact support."
- **Profile picture**: Circular div. If `avatar_url` exists, render `<img>`. Else show initials from name. "Change photo" button opens a `prompt()` for URL paste. On confirm: same PUT call with `avatar_url`.

**Security**
- Text: "Manage your password and account security."
- "Change password" button: calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${VITE_API_URL or FRONTEND_URL}/update-password' })`. On success: show "Password reset email sent" banner. On error: show error text.

**Delete account**
- Text: "Permanently delete your account and all associated data."
- "Delete account" button: opens confirmation modal. Modal explains consequences. Confirm button inside modal is **disabled** with a small note underneath: "Account deletion is not yet available. Contact support for assistance."

### Tab: Preferences
- Language dropdown using `LABELS` map. Default from `localStorage.getItem('ekithab-preferences')` or `'hi-IN'` if unset. On change: save to `localStorage` and show "Saved" confirmation.
- No other prefs exist — add a "Coming soon" empty state row below the language selector.

### Tab: Playback
- Default speed: Slider (0.5–2.0, step 0.1). Default from `localStorage.getItem('ekithab-playback')?.speed` or `1.0`. On change: save to `localStorage`. Note below slider: "This setting applies to future audio generations."
- Default voice: Reuses `<VoiceSelector>` component. Selected voice saved to `localStorage`. Note: "This setting applies to future audio generations."
- **Important**: These settings are NOT read by the existing Studio/Dashboard code. The note makes this explicit. Do not claim they affect current playback.

### Tab: Credits
- Fetch from `GET /api/settings/stats` on mount. Show loading spinner while fetching.
- Display:
  - Credits remaining: `{data.credits ?? '—'}`
  - Total credits used: `{data.totalCreditsUsed ?? '—'}`
  - Books uploaded: `{data.booksCount ?? '—'}`
- If stats fetch fails, show error banner (not silent zero values).
- Credit history list: "Coming soon" placeholder.

### Tab: Notifications
- Email updates toggle: `localStorage('ekithab-notifications', { emailUpdates: boolean })`. On change: save to localStorage, show "Preference saved" toast. No backend — badge next to label: "Not available".
- In-app notifications: toggle with "Not available" badge. No fake persistence.

---

## 7. Backend — `server/src/routes/settingsRoutes.js`

All endpoints use `authMiddleware` (already imported and mounted in `index.js`).

### `GET /api/settings/stats`
```js
const userId = req.user.id; // from authMiddleware, never from client

// Query 1: credits
const { data: userData, error: userErr } = await supabase
  .from('users').select('credits').eq('id', userId).single();
if (userErr) throw userErr; // fail loud, don't return 0

// Query 2: book count
const { count: booksCount, error: booksErr } = await supabase
  .from('books').select('*', { count: 'exact', head: true })
  .eq('user_id', userId);
if (booksErr) throw booksErr;

// Query 3: total audio duration
const { data: audioData, error: audioErr } = await supabase
  .from('audio_generations')
  .select('duration', { count: 'exact', head: false })
  .eq('user_id', userId)
  .eq('status', 'completed');
if (audioErr) throw audioErr;
const totalAudioSeconds = (audioData || []).reduce((sum, g) => sum + (g.duration || 0), 0);

res.json({
  credits: userData?.credits ?? 0,
  booksCount: booksCount ?? 0,
  totalAudioSeconds,
  memberSince: sessionUser?.created_at, // fetched separately or from auth
});
```

**Note**: `req.user` comes from `authMiddleware` which sets it from the JWT. The client must not supply a user ID.

### `PUT /api/settings/profile`
```js
const userId = req.user.id;
const { full_name, avatar_url } = req.body;

// Validate: only permit these two fields
const allowed = { full_name, avatar_url: avatar_url ?? undefined };
if (allowed.full_name !== undefined && typeof allowed.full_name !== 'string') {
  return res.status(400).json({ success: false, error: 'full_name must be a string' });
}
if (allowed.avatar_url !== undefined && typeof allowed.avatar_url !== 'string') {
  return res.status(400).json({ success: false, error: 'avatar_url must be a string' });
}

const { data, error } = await supabase.auth.admin.updateUserById(userId, { data: allowed });
if (error) throw error;
res.json({ success: true });
```

Uses `supabase.auth.admin.updateUserById` (server-side admin client, bypasses RLS). Same client instance already used in `auth.js`.

### `DELETE /api/settings/account`
**Not implemented.** No route. The client-side button is disabled.

---

## 8. API Service Extensions (`client/src/services/api.js`)

```js
export function getSettingsStats() {
  return api.get('/api/settings/stats').then((res) => res.data);
}

export function updateProfile({ full_name, avatar_url }) {
  return api.put('/api/settings/profile', { full_name, avatar_url }).then((res) => res.data);
}
```

No `requestAccountDeletion` function needed — the UI handles deletion client-side with a disabled button.

---

## 9. UpdatePassword Page

New page at `/update-password`. Handles the Supabase password recovery redirect.

```jsx
// Reads URL params: ?type=recovery&token=...
// Shows password input + confirm input + submit button
// On submit: supabase.auth.updateUser({ password })
// On success: redirect to /settings
// On error: show error message
```

Register in `App.jsx` switch. Redirect URL for `resetPasswordForEmail` should be the production frontend URL (read from env or default to `http://localhost:5175`).

---

## 10. Password Recovery Flow

1. User clicks "Change password" on Account tab
2. `supabase.auth.resetPasswordForEmail(email, { redirectTo: '{FRONTEND_URL}/update-password' })` called
3. Supabase sends email with reset link
4. User clicks link → redirected to `/update-password?type=recovery&token=...`
5. `UpdatePassword.jsx` renders password form
6. User enters new password → `supabase.auth.updateUser({ password })`
7. Auth state changes → redirect to `/settings` with success message

**Supabase project requirement**: The `redirectTo` URL must be added to the project's trusted redirect URLs in Supabase dashboard (or use wildcard `*` for local dev). Document this as a setup note.

---

## 11. localStorage Keys

No existing keys in the codebase. Use these fresh keys:
- `ekithab-preferences` — `{ language: string }`
- `ekithab-playback` — `{ speed: number, voice: string }`
- `ekithab-notifications` — `{ emailUpdates: boolean }`

Parse with fallback on miss. Stringify on every write.

---

## 12. Right-Hand Panel Cards

### AccountOverviewCard
Fetches stats on mount. Shows loading skeleton. On error, shows error state.
- Plan: always "Free Plan" (no subscription system exists)
- "Upgrade Plan" button: shows "Coming soon" toast on click (no action)
- Stats rows with icons from `lucide-react`

### ConnectedDevicesCard
- Parse `navigator.userAgent` to extract OS and browser
- Show: device icon, generic device name ("Current device"), OS • Browser • Location (if available)
- "Last active: Now"
- Badge: "Current device" in terracotta tint

### DangerZoneCard
- Red outlined "Delete account" button
- On click: confirmation modal
- Modal confirm button: disabled, with tooltip "Account deletion is not yet available"
- Warning text below button

---

## 13. Data Sources Summary

| Data | Source | Fallback |
|------|--------|----------|
| Full name | `session.user.user_metadata.full_name` | `session.user.email` |
| Email | `session.user.email` | — |
| Avatar | `session.user.user_metadata.avatar_url` | Initials from name |
| Member since | `session.user.created_at` | — |
| Credits | `GET /api/settings/stats` → `users.credits` | `'—'` during loading |
| Books count | `GET /api/settings/stats` → `COUNT(books)` | `'—'` during loading |
| Audio duration | `GET /api/settings/stats` → `SUM(audio_generations.duration)` | `0` if no generations |
| Device info | `navigator.userAgent` (client) | Generic labels |

---

## 14. Prop Compatibility Checklist

### `Sidebar.jsx` (modified)
- Props preserved: `book`, `activeChapterIdx`, `onChapterSelect`, `onNavClick`, `isMobileOpen`, `onCloseMobile`, `activePath`
- `NAV_ITEMS` array mutated: Settings route changed from `'#'` to `'/settings'`, `active: false` removed
- `isRoute` logic: `item.route !== '#'` means Settings is now treated as a route → click handler fires → `onNavClick('/settings')`
- Chapter list section guarded by `book &&` — no change needed

### `MyBooksSidebar.jsx` (modified)
- Props preserved: `activeItem`, `onNavClick`, `activePath`
- Same `NAV_ITEMS` mutation as above
- `activeItem` fallback still works for Studio/My Books highlighting

### `TopBar.jsx` (NOT modified)
- Settings page uses its own `SettingsTopBar.jsx`
- No impact on Dashboard/Studio

### `MainLayout.jsx` (NOT modified)
- Settings page does not use `MainLayout`
- No impact on existing layout

### `AuthContext.tsx` (NOT modified)
- No changes to context shape or exports

---

## 15. Regression Tests

| Check | How to verify |
|-------|--------------|
| Studio loads normally | Navigate to `/`, confirm book loads, sidebar highlights "Studio" |
| My Books loads normally | Navigate to `/my-books`, confirm books render, sidebar highlights "My Books" |
| Settings opens from Studio sidebar | Click Settings → lands on `/settings`, sidebar highlights Settings |
| Settings opens from My Books sidebar | Click Settings → lands on `/settings`, MyBooksSidebar highlights Settings |
| Back button from Settings | Press browser Back → returns to previous page, not stuck on `/settings` |
| Auth redirect | Log out → navigate to `/settings` → redirected to `/login` |
| Tab switching | Click each tab → content changes, URL stays `/settings`, sidebar stays highlighted |
| Profile save | Edit name → Save → reload page → name persists |
| Profile cancel | Edit name → Cancel → reload page → name reverts |
| Playback settings persist | Set speed to 1.5x → reload Settings → speed shows 1.5x |
| No prop errors in console | Check browser devtools console for React prop mismatch warnings |

---

## 16. Visual Verification Checklist

| Element | Requirement | Pass / Fail |
|---------|------------|-------------|
| Global sidebar matches screenshot | Same logo, nav items, status card, profile section | _pending_ |
| Settings nav active item | Terracotta background, left border accent | _pending_ |
| Settings nav inactive items | Muted text, hover state | _pending_ |
| Page heading | Serif font, `text-3xl`, correct spacing below | _pending_ |
| Form inputs | Rounded, bordered, consistent padding | _pending_ |
| Account tabs layout | Sectioned with borders, labels above inputs | _pending_ |
| Danger zone button | Red outline, red text, correct sizing | _pending_ |
| Right cards | White bg, thin border, rounded corners, consistent padding | _pending_ |
| Three-column alignment | No horizontal overflow at 1280px and 1440px | _pending_ |
| Mobile stack | Single column at < 1024px, cards stack below content | _pending_ |

---

## 17. Deferred Features (Explicitly Out of Scope)

| Feature | Reason | Status |
|---------|--------|--------|
| Account deletion | Requires Supabase admin deleteUser + FK cascade verification + storage cleanup | UI shows disabled button with "Not yet available" |
| Email change | Requires Supabase email verification flow | Read-only display with "contact support" note |
| Avatar upload | No storage endpoint exists | URL-only update via prompt |
| Credit transaction history | No endpoint surfaces ledger data | "Coming soon" placeholder |
| Per-device session tracking | No device tracking in app | Single device shown (current browser) |
| Real notification backend | No notification system exists | localStorage-only with "Not available" badge |
| Subscription/plan management | No billing system | Hardcoded "Free Plan" |
| Upgrade Plan checkout | No checkout flow | Toast: "Coming soon" |

---

## 18. Implementation Order

1. **Backend**: Create `settingsRoutes.js`, add endpoints, mount in `index.js`
2. **API client**: Add `getSettingsStats()` and `updateProfile()` to `api.js`
3. **Routing**: Add `/settings` and `/update-password` cases to `App.jsx`
4. **Sidebars**: Enable Settings in `Sidebar.jsx` and `MyBooksSidebar.jsx`
5. **UpdatePassword page**: Create page for password reset completion
6. **SettingsTopBar**: Create component
7. **SettingsNav**: Create left navigation panel
8. **AccountTab**: Full implementation (profile, security, danger zone)
9. **PreferencesTab**: Language selector with localStorage
10. **PlaybackTab**: Speed slider + voice selector with localStorage
11. **CreditsTab**: Stats fetch and display
12. **NotificationsTab**: Toggle with localStorage + "Not available" badges
13. **Right panel cards**: Create 3 card components
14. **Settings.jsx shell**: Assemble all pieces, test layout
15. **Visual polish**: Verify against reference screenshot

---

## 19. Setup Note (Non-Code)

Before testing password recovery end-to-end, the `redirectTo` URL must be registered in the Supabase project's authentication settings:
- Go to Supabase Dashboard → Authentication → URL Configuration
- Add `{FRONTEND_URL}/update-password` (or `*` for local dev wildcard) to authorized redirect URLs

Without this, the password reset email link will be rejected by Supabase.

---

**Plan is implementation-ready. All safeguards incorporated.**
