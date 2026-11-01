# Phase 1 — Ekithab AI Home Page UI & Visual Foundation

## Final Implementation Plan

### 1. Authentication Flow Verification
**Current:** Landing (`/`) → Login (`/auth`) → MyBooks (`/my-books`)
**Required:** Landing (`/`) → Login (`/auth`) → **Home (`/home`)**

**Findings:**
- `App.jsx` redirects authenticated users from `/` and `/auth` to `/my-books`
- `AuthPage.jsx` (line 43), `Login.jsx` (line 20), `Register.jsx` (line 26) redirect to `/my-books`
- Logout already returns to `/` (verified across all components)
- No other auth redirects exist

**Changes:** Update 5 redirect locations to `/home`. Add `/home` route to App.jsx.

### 2. Data Sources Confirmed
**`getSettingsStats()`** → `{ credits, booksCount, totalAudioSeconds }`
**`getAllLibraryAudio()`** → `{ items: [{ chapterId, bookTitle, coverUrl, durationSeconds, audioUrl, createdAt }] }`**
**`getBooks()`** → `{ books: [{ id, title, cover_url, total_chapters, last_opened_at }] }`

**Continue Listening Data:** No listening history table exists. Existing `audioLibrary/ContinueListening` uses hardcoded progress — we must NOT reuse it. Since no genuine listening data exists, show empty state.

### 3. Files to Create (7 components)

#### `client/src/pages/Home.jsx`
- Shell component
- Fetches: `getSettingsStats()`, `getAllLibraryAudio()`, `getBooks()`
- State: `credits`, `recentAudio`, `books`, `loading`
- Renders: Hero, FeatureCards, ContinueListening, QuickActions

#### `client/src/components/home/Hero.jsx`
- Welcome badge + serif heading + description
- Terracotta CTA button → `navigate('/my-books')`
- Right side: CSS composition with book/headphone icons (no external image)

#### `client/src/components/home/FeatureCards.jsx`
- 4 cards with pastel backgrounds (green, blue, orange, lavender)
- Icons: FileText, Mic, Sliders, Smartphone
- Serif headings, sans-serif descriptions

#### `client/src/components/home/ContinueListening.jsx`
- Empty state: centered text + subtle book icon
- "No listening history yet" + "Generate your first audiobook"
- "Upload a Book" button (navigates to `/my-books`)
- **No progress bars** — spec forbids inventing progress data

#### `client/src/components/home/QuickActions.jsx`
- 4 cards: Upload, Browse My Books, Recent Activity, Settings
- Icon containers: `bg-terracotta/10`
- Right arrows, subtle borders
- "Recent Activity" → `navigate('/my-books')` (closest available per Phase 1)

#### `client/src/components/home/HomeSidebar.jsx`
- New component, not modifying existing sidebars
- Nav: Home (active), My Books, Audio Library, Studio, Settings
- Footer: Credits card (`$120 Credits remaining` or `—`), User profile
- Logo: Book icon + "Ekithab AI" + "Books. Voices. Anywhere."

#### `client/src/components/home/HomeTopBar.jsx`
- Search input, Bell icon, User avatar with dropdown
- Matches reference screenshot 2 styling

### 4. Files to Modify (4)

#### `client/src/App.jsx`
- Import `Home` component
- Add `/home` case in switch
- Update 3 redirect targets to `/home`
- Update `if (path === '/my-books') return;` → `if (path === '/home') return;`

#### `client/src/pages/AuthPage.jsx` (line 43)
- Change `navigate('/my-books')` → `navigate('/home')`

#### `client/src/pages/Login.jsx` (line 20)
- Change `window.location.href = '/my-books'` → `'/home'`

#### `client/src/pages/Register.jsx` (line 26)
- Change `window.location.href = '/my-books'` → `'/home'`

### 5. Sidebar Integration
Create `HomeSidebar.jsx` as a NEW component. Do NOT modify existing sidebars (Dashboard, MyBooks, Audio Library, Settings). The Home page uses its own sidebar to match the reference design while preserving existing navigation behavior on other pages.

### 6. Visual Design Details
- Colors: `bg-background` (#FAF9F6), `bg-sidebar` (#F3F1EC), `text-terracotta`, `bg-terracotta/10`
- Typography: Serif for headings (Lora), Sans-serif for body (Inter/system-ui)
- Spacing: Max width `max-w-7xl`, section padding `px-6 py-8`
- Responsive: Desktop (lg) = full sidebar, 4-col cards; Tablet (md) = collapsible sidebar, 2-col cards; Mobile = stacked layout

### 7. Empty States
- **Continue Listening**: Show centered message with subtle icon
- **Credits**: Show "—" if unavailable
- **No books**: Feature cards still render; Quick Actions navigate appropriately

### 8. Validation Checklist
- [ ] Navigate to `/home` → renders without errors
- [ ] Welcome name displays from auth metadata
- [ ] Sidebar shows "Home" as active
- [ ] Credits card shows real balance or "—"
- [ ] Hero section matches reference proportions/colors
- [ ] 4 Feature Cards render correctly
- [ ] Continue Listening shows empty state (no hardcoded progress)
- [ ] Quick Actions all 4 cards render
- [ ] No horizontal overflow at any breakpoint
- [ ] `npm run build` succeeds
- [ ] No prop mismatches or console warnings
- [ ] Logout returns to Landing page
- [ ] OAuth redirect lands on `/home`

### 9. Out of Scope
- Adding "Recent" nav item (Phase 2)
- Per-chapter listening progress tracking
- Cross-page navigation integration
- Global sidebar restructuring
- Backend API changes

---

**All assumptions verified against actual code.** Ready for implementation.

**Plan file:** `.kilo/plans/1793366948742-home-page-ui-phase1.md`