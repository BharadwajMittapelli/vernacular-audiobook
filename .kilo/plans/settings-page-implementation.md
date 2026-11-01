# Settings Page Implementation Plan

## 1. Current Architecture

### Navigation Pattern
- `App.jsx` uses URL-based routing via `pathname` state + `history.pushState`
- Pages: `/` (Dashboard), `/my-books`, `/login`, `/register`, `/listen/:bookId`
- `NavigateContext` provides `navigate(newPath)` to all components
- Sidebar uses `NAV_ITEMS` array; Settings currently has `route: '#'` (disabled)

### Layout Architecture
- `MainLayout.jsx` wraps Dashboard with `Sidebar` + `TopBar` + `main`
- Dashboard's TopBar only shows menu button (mobile) + notifications + avatar/signout
- MyBooks has its own `MyBooksSidebar` + `MyBooksTopBar` pattern
- No shared `SettingsLayout` exists yet

### Auth / User Data
- `AuthContext.tsx` exposes `session.user` with `user_metadata.full_name`, `email`, `avatar_url`
- Session access_token sent automatically via API interceptor
- No dedicated user profile API endpoint exists (Supabase auth users table is separate from `public.users`)

### Existing Components Available
- `Button` (variant, size variants)
- `Sidebar` (with mock-user dev mode, book chapter list)
- `TopBar` (mobile menu + notifications + avatar)
- `icon` components from `lucide-react`

---

## 2. Reusable Components

| Component | Existing? | Notes |
|-----------|-----------|-------|
| Sidebar navigation | Yes, needs update | Add Settings route to NAV_ITEMS |
| TopBar search + avatar | No, need to modify or create | Dashboard TopBar lacks search; Settings needs different header |
| Button component | Yes | `variant="outline"`, `variant="default"` (terracotta) |
| Avatar initials | Yes, in TopBar/Sidebar | Reuse same initials logic |
| Input fields | Need to check | Check if `Input` component exists |
| Card component | Need to check | Check for existing card wrapper |

---

## 3. Files to Create

### New Files
1. **`client/src/pages/Settings.jsx`** — Main settings page (3-column layout, tab state)
2. **`client/src/components/settings/SettingsSidebar.jsx`** — Left column: tab navigation
3. **`client/src/components/settings/SettingsTopBar.jsx`** — Header: search + notifications + avatar
4. **`client/src/components/settings/AccountTab.jsx`** — Account tab content
5. **`client/src/components/settings/PreferencesTab.jsx`** — Preferences tab content
6. **`client/src/components/settings/PlaybackTab.jsx`** — Playback tab content
7. **`client/src/components/settings/CreditsTab.jsx`** — Credits tab content
8. **`client/src/components/settings/NotificationsTab.jsx`** — Notifications tab content
9. **`client/src/components/settings/AccountOverview.jsx`** — Right column overview cards

---

## 4. Files to Modify

### `client/src/App.jsx`
- Add `/settings` route case in the switch statement
- Wrap Settings page with `NavigateContext.Provider`

### `client/src/components/layout/Sidebar.jsx`
- Change Settings `NAV_ITEM` from `route: '#'` to `route: '/settings'`
- Update `isRoute` check so Settings is clickable
- Keep active-state styling consistent with other items

### `client/src/components/layout/TopBar.jsx`
- **Option A:** Add a `variant` prop to render differently for Settings vs Dashboard
- **Option B:** Create separate `SettingsTopBar.jsx` and use it in Settings page only
- **Recommended:** Option B — cleaner separation, no conditional rendering in shared component

---

## 5. Three-Column Component Structure

```
Settings.jsx
├── SettingsTopBar          (full width, search + avatar)
└── <div className="flex gap-6 px-8 py-6">
    ├── SettingsSidebar     (col-span-1, ~200px)
    │   └── 5 tab buttons (vertical list)
    ├── MainContent         (col-span-1, flex-1)
    │   └── Active tab component (AccountTab, etc.)
    └── AccountOverview     (col-span-1, ~280px)
        ├── Account plan card
        ├── Connected devices card
        └── Danger zone card
```

Proportions match reference: sidebar ~15%, content ~60%, overview ~25%.

---

## 6. Tab Implementation

### State
```javascript
const [activeTab, setActiveTab] = useState('account');
```

### Tab Definitions
```javascript
const TABS = [
  { id: 'account',    label: 'Account',    subtitle: 'Profile and security' },
  { id: 'preferences',label: 'Preferences',subtitle: 'Language and audio' },
  { id: 'playback',   label: 'Playback',   subtitle: 'Default listening settings' },
  { id: 'credits',    label: 'Credits',    subtitle: 'Usage and billing' },
  { id: 'notifications',label: 'Notifications',subtitle: 'Email and updates' },
];
```

### Active State Styling
- Selected tab: `bg-settings` (warm off-white `#F7F6F2`) + left border accent in terracotta
- Unselected: `hover:bg-muted` + `text-muted-foreground`

---

## 7. Data Sources

| Data Point | Source | Availability |
|------------|--------|--------------|
| User name | `session.user.user_metadata.full_name` | ✅ Available |
| User email | `session.user.email` | ✅ Available |
| User avatar | `session.user.user_metadata.avatar_url` | ✅ Available |
| Credits remaining | `public.users.credits` (via RPC `get_user_balance`) | ⚠️ Need to check if accessible from client |
| Books uploaded | `GET /api/studio` count books | ✅ Available |
| Audio generated | ❌ No endpoint exists | **UI-only / placeholder** |
| Member since | `session.user.created_at` (Supabase auth) | ✅ Available |
| Current device | ❌ No endpoint exists | **UI-only / placeholder** |
| Plan info | ❌ No subscription system exists | **UI-only / placeholder** |

### Credentials for API calls
- Supabase anon key + service role key in `.env`
- Client-side: use `supabase` client from `lib/supabaseClient.js`
- Server-side: use service role key from `server/.env`

### Realistic Data Handling
- **Credits remaining:** Can fetch via `GET /api/studio` or existing API if user data endpoint exists. If not, show placeholder.
- **Books uploaded:** Call `getBooks()` and count results.
- **Audio generated:** Show "N/A" or estimate from book data.
- **Connected devices:** Show current device info from user-agent or placeholder.
- **Plan:** Show "Free Plan" with "Upgrade Plan" button (disabled/non-functional since no billing exists).

---

## 8. Action Feasibility Matrix

| Action | Backend Support | Implementation |
|--------|----------------|----------------|
| View profile info | ✅ (auth session) | Direct from session |
| Change photo | ❌ | UI only, show "Coming soon" or disabled |
| Change password | ❌ (Supabase auth supports it) | Wire to `supabase.auth.updateUser()` |
| Delete account | ⚠️ Partial | Frontend can call `supabase.auth.admin.deleteUser()` but risky; show confirmation dialog + disabled until backend supports |
| Edit preferences | ❌ | Local state only |
| Edit playback speed | ❌ | Local state only |
| Notification prefs | ❌ | Local state only |
| View credits | ⚠️ Depends | Check if `get_user_balance` RPC works from client |
| Upgrade plan | ❌ | Button shown but non-functional with toast "Coming soon" |

---

## 9. Responsive Strategy

- **Desktop (>1024px):** 3-column layout as designed
- **Tablet (768–1024px):** Collapse overview column below main content; keep sidebar + content side by side
- **Mobile (<768px):** Full-width tabs (horizontal scroll or drawer), stacked cards

Implementation:
```jsx
<div className="flex flex-col lg:flex-row gap-6">
  {/* Settings sidebar - full width on mobile */}
  <aside className="w-full lg:w-56 shrink-0">...</aside>
  
  {/* Main content - flex-1 */}
  <main className="flex-1 min-w-0">...</main>
  
  {/* Overview - full width on mobile, below content on tablet */}
  <aside className="w-full lg:w-72 xl:w-80 shrink-0 lg:mt-0 mt-6">...</aside>
</div>
```

---

## 10. Risks and Safeguards

### Risks
1. **Sidebar conflict:** Dashboard sidebar shows book chapters; Settings sidebar should not. → Use conditional rendering in `Sidebar.jsx` based on `activePath`.
2. **Auth data timing:** Settings page loads before `session` is ready. → Guard with `if (!session) return <Loading />`.
3. **Credits data:** `get_user_balance` RPC may require auth role that client doesn't have. → Fall back to placeholder.
4. **Delete account:** Destructive action without backend confirmation. → Show confirmation modal + disable until we confirm backend support.

### Safeguards
- All destructive actions require confirmation dialog
- No real deletion without explicit backend endpoint
- Placeholder text for unsupported features: "Coming soon" or "Not available"
- Keep existing Studio/My Books pages unchanged

---

## 11. Verification Checklist

### Navigation
- [ ] Sidebar Settings link is enabled and clickable
- [ ] Clicking Settings navigates to `/settings`
- [ ] Settings page renders without errors
- [ ] Back navigation from Settings works

### Tabs
- [ ] Account tab is selected by default
- [ ] Clicking each tab switches content panel
- [ ] Active tab has correct highlight styling
- [ ] All 5 tabs display unique content

### Account Tab
- [ ] Name field populated from session
- [ ] Email field populated from session
- [ ] Avatar displays initials or image
- [ ] Change photo button present (non-functional with "Coming soon")
- [ ] Change password button present
- [ ] Delete account button present with confirmation dialog

### Account Overview (Right Column)
- [ ] Plan card shows "Free Plan"
- [ ] Credits remaining shows real value or placeholder
- [ ] Books uploaded count is real
- [ ] Audio generated shows placeholder
- [ ] Member since shows real date
- [ ] Connected devices shows placeholder
- [ ] Danger zone card has delete account button

### Styling
- [ ] Warm off-white background matches reference
- [ ] Card borders and rounded corners match
- [ ] Terracotta accent used consistently
- [ ] Typography hierarchy matches (heading, label, description)
- [ ] Spacing and proportions match reference

### Responsiveness
- [ ] Desktop: 3 columns visible
- [ ] Tablet: overview moves below content
- [ ] Mobile: stacked layout, no overflow
- [ ] Tabs usable on all breakpoints

### Regression
- [ ] Studio page still works
- [ ] My Books page still works
- [ ] Navigation between pages unchanged
- [ ] Auth flow unchanged

---

## 12. Implementation Order

1. **Update navigation:** Modify `Sidebar.jsx` (enable Settings route)
2. **Create Settings page shell:** `Settings.jsx` with routing in `App.jsx`
3. **Create SettingsTopBar:** Search + avatar header
4. **Create SettingsSidebar:** Tab navigation component
5. **Create AccountOverview:** Right column cards
6. **Create each tab component:** Account, Preferences, Playback, Credits, Notifications
7. **Wire up data:** Connect to session/auth for real data
8. **Add responsive styles:** Tailwind breakpoints
9. **Final polish:** Spacing, colors, typography matching reference
