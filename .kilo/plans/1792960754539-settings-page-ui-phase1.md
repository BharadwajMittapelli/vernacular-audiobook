# Settings Page — Phase 1 Implementation Plan

## 1. Current State Summary

### What exists
- `App.jsx` — imports `Settings` from `'./pages/Settings.jsx'` (line 9) but **that file does not exist**. The `/settings` route is wired in the switch (lines 83–88).
- `client/src/components/settings/SettingsNav.jsx` — vertical nav with 5 tabs. Uses a card-wrapped list with single-left-border active state. Does **not** match the reference screenshot's active-item style.
- `client/src/components/settings/SettingsTopBar.jsx` — header with search + bell + avatar. Already exists and is close to the reference.
- `client/src/components/settings/AccountTab.jsx` — full Account tab with real API calls (save profile, change password via Supabase). More feature-rich than Phase 1 needs; acceptable to reuse as-is.
- `client/src/components/settings/AccountOverviewCard.jsx` — right column plan/stats card. Fetches from `getSettingsStats()`. Acceptable.
- `client/src/components/settings/ConnectedDevicesCard.jsx` — right column device card. Client-side UA parsing. Acceptable.
- `client/src/components/settings/DangerZoneCard.jsx` — right column danger zone card. Acceptable.
- `client/src/components/settings/PreferencesTab.jsx`, `PlaybackTab.jsx`, `CreditsTab.jsx`, `NotificationsTab.jsx` — stub tabs with localStorage persistence. Acceptable for Phase 1.
- `client/src/components/layout/Sidebar.jsx` — global sidebar. Settings nav item has `route: '/settings'` and is **already enabled** (line 10). Active state uses `bg-terracotta/10 text-terracotta`. Close but the screenshot shows the active item with a slightly different style.
- `client/src/components/books/MyBooksSidebar.jsx` — duplicate sidebar for My Books page. Settings nav item also has `route: '/settings'` (line 9). Already enabled.
- `client/src/components/layout/TopBar.jsx` — Studio top bar. **Not reused** by Settings.
- Tailwind config defines `--settings: 40 14% 95%` (warm off-white `#F7F6F2`) — this is the background color used in the screenshot.
- No `pages/Settings.jsx` exists.

### What is missing
- `client/src/pages/Settings.jsx` — the main page component that assembles the three-column layout.
- Minor visual adjustments to `SettingsNav.jsx` to match the reference (active tab should have a warm terracotta-tinted background `bg-settings` with terracotta left border, not the current `border-l-2 border-terracotta` without background).
- `App.jsx` routing for `/update-password` (the existing plan references this; Phase 1 can skip it if not needed for the screenshot).

---

## 2. Reused Components

| Component | File | Changes Needed |
|-----------|------|----------------|
| `Sidebar` | `components/layout/Sidebar.jsx` | None — Settings is already enabled with route `/settings` |
| `MyBooksSidebar` | `components/books/MyBooksSidebar.jsx` | None — Settings is already enabled |
| `SettingsTopBar` | `components/settings/SettingsTopBar.jsx` | None — visually matches reference |
| `SettingsNav` | `components/settings/SettingsNav.jsx` | **Minor**: add `bg-settings` background to active item to match reference |
| `AccountTab` | `components/settings/AccountTab.jsx` | None — works as-is |
| `AccountOverviewCard` | `components/settings/AccountOverviewCard.jsx` | None — works as-is |
| `ConnectedDevicesCard` | `components/settings/ConnectedDevicesCard.jsx` | None — works as-is |
| `DangerZoneCard` | `components/settings/DangerZoneCard.jsx` | None — works as-is |
| Tab stubs | `components/settings/PreferencesTab.jsx`, `PlaybackTab.jsx`, `CreditsTab.jsx`, `NotificationsTab.jsx` | None — acceptable for Phase 1 |
| `Button` | `components/ui/button.jsx` | Reused where needed |
| `useAuth`, `useNavigate` | contexts | Reused |

---

## 3. Files to Create

### `client/src/pages/Settings.jsx` (new)
Main page component. Assembles the three-column layout:
- `SettingsTopBar` at top
- Heading "Settings" with subtitle
- Three-column flex row: `SettingsNav` | tab content | overview cards stack
- Responsive: stacks to single column on mobile

```
Settings.jsx
├── SettingsTopBar (full width)
└── <main className="flex-1 overflow-y-auto">
    ├── <div className="max-w-7xl mx-auto px-8 py-8">
    │   ├── h1 "Settings" + subtitle
    │   └── flex gap-6
    │       ├── SettingsNav (w-60 shrink-0)
    │       ├── content area (flex-1 min-w-0)
    │       └── right cards stack (w-72 shrink-0 space-y-4)
    │           ├── AccountOverviewCard
    │           ├── ConnectedDevicesCard
    │           └── DangerZoneCard
    └── </div>
</main>
```

State: `useState('account')` for active tab. Switch renders the appropriate tab component.

---

## 4. Files to Modify

### `client/src/components/settings/SettingsNav.jsx`
**Change**: Add `bg-settings` background to the active tab item.

Current active style (line 32):
```jsx
'bg-terracotta/8 border-l-2 border-terracotta'
```

Should become:
```jsx
'bg-settings border-l-2 border-terracotta'
```

This matches the reference screenshot where the active "Account" row has a warm off-white background (`#F7F6F2`, the `--settings` token) with a terracotta left accent border.

All other props and exports remain unchanged. No prop signature changes.

### `client/src/App.jsx`
**No changes needed.** The `/settings` route case already exists (lines 83–88) and wraps Settings with `NavigateContext.Provider`. The only gap is that `Settings.jsx` doesn't exist yet — once created, the import resolves.

---

## 5. Layout and Styling Strategy

### Three-column proportions
Based on the reference screenshot and available viewport:
- Global sidebar: fixed `w-64` (256px)
- SettingsNav: fixed `w-60` (240px)
- Main content: `flex-1 min-w-0` (remaining space)
- Right cards: fixed `w-72` (288px)
- Gap between columns: `gap-6` (24px)

At 1280px viewport minus 256px sidebar = 1024px available. Columns use 240 + ~488 + 288 + 24 = 1040px. This fits tightly but the `min-w-0` on the flex-1 content area prevents horizontal overflow. On wider viewports (1440px+) there is comfortable breathing room.

### Background colors
- Page background: `bg-background` (`#FAF9F6` warm off-white)
- Settings nav card background: implicit from `bg-card` (white)
- Active nav item background: `bg-settings` (`#F7F6F2` slightly warmer)
- Right cards: `bg-card` (white) with `border border-border`

### Typography
- Page heading: `text-3xl font-serif font-semibold text-foreground` (Lora serif as used elsewhere)
- Subtitle: `text-muted-foreground text-sm mt-1`

### Responsive behavior
- `≥ 1024px`: three-column layout as described
- `< 1024px`: collapse right cards below content, keep nav + content side-by-side
- `< 768px`: single column, full-width nav items (horizontal scroll or stacked)

Implementation:
```jsx
<div className="flex flex-col xl:flex-row gap-6">
  <SettingsNav ... />
  <div className="flex-1 min-w-0">{/* tab content */}</div>
  <div className="w-full xl:w-72 shrink-0 space-y-4 xl:mt-0 mt-6">
    {/* cards */}
  </div>
</div>
```

---

## 6. Placeholder Data Strategy

Phase 1 uses existing components which already handle data correctly:
- **Account info** (name, email, avatar): comes from `session.user` via `useAuth()` — real data, no placeholders needed.
- **Credits/books/audio stats**: `AccountOverviewCard` calls `getSettingsStats()` which hits the API. If the backend endpoint doesn't exist, the component shows `'—'` during loading and errors gracefully. This is acceptable for Phase 1.
- **Plan info**: hardcoded "Free Plan" in `AccountOverviewCard` — correct for Phase 1.
- **Connected devices**: client-side UA parsing in `ConnectedDevicesCard` — no backend needed.
- **Danger zone**: purely presentational in `DangerZoneCard`.

No additional placeholder data is needed beyond what the existing components already provide.

---

## 7. Prop Compatibility

| Component | Props | Risk |
|-----------|-------|------|
| `SettingsNav` | `{ activeTab, onTabChange }` | **None** — no changes to signature, only visual tweak |
| `AccountOverviewCard` | none | **None** |
| `ConnectedDevicesCard` | none | **None** |
| `DangerZoneCard` | none | **None** |
| `AccountTab` | none | **None** |
| Other tabs | none | **None** |

No changes to any existing component's props or exports.

---

## 8. Regression Safeguards

- `Sidebar.jsx` unchanged — Settings nav item was already enabled.
- `MyBooksSidebar.jsx` unchanged — Settings nav item was already enabled.
- `TopBar.jsx` unchanged — Settings page uses its own `SettingsTopBar`.
- `MainLayout.jsx` unchanged — Settings page does not use it.
- `Dashboard.jsx`, `MyBooks.jsx` — no modifications, no prop changes.
- `AuthContext.tsx` — no modifications.
- `App.jsx` — no modifications (Settings import will resolve once the file is created).

---

## 9. Verification Checklist

### Navigation
- [ ] Clicking "Settings" in the global sidebar navigates to `/settings`
- [ ] Settings nav item in sidebar is highlighted with `bg-terracotta/10 text-terracotta`
- [ ] Browser Back button returns to previous page

### Layout
- [ ] Three columns visible on desktop (≥1024px)
- [ ] Right cards stack below content on tablet (<1024px)
- [ ] Single column on mobile (<768px)
- [ ] No horizontal overflow at any breakpoint

### Settings Navigation
- [ ] "Account" tab selected by default with warm background + terracotta left border
- [ ] Clicking each tab switches content without URL change
- [ ] All 5 tabs display their respective content

### Account Tab
- [ ] Name field populated from session user metadata
- [ ] Email field shown (disabled)
- [ ] Avatar shows initials or image
- [ ] "Change photo" button present
- [ ] "Change password" button present
- [ ] "Delete account" button present (non-functional, disabled in modal)

### Right Cards
- [ ] Account Overview card shows "Free Plan" and stats
- [ ] Connected Devices card shows current device info
- [ ] Danger Zone card shows delete button

### Styling
- [ ] Warm off-white background throughout
- [ ] Terracotta accent used for active states and primary buttons
- [ ] Card borders and rounded corners consistent
- [ ] No clipping or overflow

### Regression
- [ ] Studio page still loads and works
- [ ] My Books page still loads and works
- [ ] No console errors

---

## 10. Implementation Order

1. **Fix `SettingsNav.jsx`** — change active item background to `bg-settings`
2. **Create `pages/Settings.jsx`** — assemble the three-column layout, wire all components
3. **Verify** — open `/settings` in browser, compare against reference screenshot
4. **Responsive check** — resize browser, verify stacking behavior

---

## 11. Out of Scope for Phase 1

- Backend API endpoints for settings stats or profile updates (deferred to Phase 3)
- Full tab-switching state persistence across page reloads (tabs reset to Account on refresh — acceptable for Phase 1)
- Password recovery flow (`/update-password` route) — deferred
- Real avatar upload (URL-only update via prompt is acceptable)
- Account deletion implementation (UI only, button disabled)
- Credit transaction history
- Notification backend integration
