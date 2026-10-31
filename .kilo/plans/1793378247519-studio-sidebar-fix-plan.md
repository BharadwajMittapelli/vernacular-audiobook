# Studio Sidebar Fix Plan

## Root Cause Analysis
- `StudioLayout` renders `Sidebar` component inside `AppLayout`'s `contextualSidebar` slot.
- `Sidebar.jsx` contains both global navigation items (Studio, My Books, Audio Library, Settings) AND book/chapter list.
- `AppSidebar` (global) already renders the same navigation items.
- This causes **double sidebars** on the Studio page.

## Current File Dependencies

| File | Uses Sidebar | Notes |
|------|--------------|-------|
| `StudioLayout.jsx` | ✅ | Passes `Sidebar` as `contextualSidebar` to `AppLayout` |
| `MainLayout.jsx` | ✅ | Uses `Sidebar` directly (standalone layout) |
| `AppLayout.jsx` | ❌ | Uses `AppSidebar` only |

## Proposed Solution

### 1. Create `client/src/components/layout/ChapterListPanel.jsx`
Extract **ONLY** the book metadata and chapter list portion from `Sidebar.jsx`:

**Include:**
- Book title, cover initials (first 2 chars uppercase)
- Chapter count display
- Scrollable chapter list with:
  - Status indicator dots (completed: green, processing: yellow pulse, failed: red, pending: gray)
  - Sequence numbers (01, 02, etc.)
  - Chapter titles (truncated)
  - Reading time estimates (`estimateMinutes` helper)
- `onChapterSelect(index)` callback for chapter switching
- Active chapter highlight (`activeChapterIdx` prop)

**Exclude:**
- Global navigation items (`NAV_ITEMS` array)
- Brand header/logo ("Ekithab AI Audiobook")
- Mobile overlay/close button
- Footer status ("Studio Online")
- User profile/avatar section
- Credits display
- Logout button

### 2. Update `client/src/components/layout/StudioLayout.jsx`
- Replace `Sidebar` import with `ChapterListPanel`
- Pass props: `book`, `activeChapterIdx`, `onChapterSelect`
- **Remove** mobile menu state (`mobileMenuOpen`, `setMobileMenuOpen`) - handled by `AppLayout`/`AppTopBar`
- Keep `contextualSidebar` contract with `AppLayout`

### 3. Investigate & Update `client/src/components/layout/MainLayout.jsx`
**Before changing:**
- [ ] Confirm `MainLayout` usage (search for imports)
- [ ] Confirm it's used for book reading (not Studio)
- [ ] Verify it needs chapter list functionality
- [ ] Check if mobile menu is handled by `TopBar` or internally

**If confirmed needed:**
- Replace `Sidebar` import with `ChapterListPanel`
- Pass props: `book`, `activeChapterIdx`, `onChapterSelect`
- **Preserve** mobile menu state and `TopBar` integration
- **Do NOT** force into `AppLayout` architecture

### 4. Delete `client/src/components/layout/Sidebar.jsx`
- After confirming all functionality migrated (grep for imports)
- Verify no other dependencies

## File-by-File Change Plan

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/layout/ChapterListPanel.jsx` | **Create** | Book metadata + chapter list UI only |
| `client/src/components/layout/StudioLayout.jsx` | **Modify** | Import `ChapterListPanel`, remove mobile menu state |
| `client/src/components/layout/MainLayout.jsx` | **Investigate → Modify** | Replace only if chapter list needed; preserve mobile behavior |
| `client/src/components/layout/Sidebar.jsx` | **Delete** | After full migration verified |

## Phase 3 Protection (Preserve Exactly)
- AudioContext initialization
- GlobalPlayer component
- Playback persistence across navigation
- Chapter switching functionality
- Studio generation workflow
- Transcript synchronization
- Export functionality

**No** additional audio elements, playback systems, or audio-related refactoring.

## Strict Constraints
- Zero prop mismatches
- No invented component contracts
- No backend/API/database changes
- No unnecessary dependencies
- No unrelated refactoring
- Preserve Phase 1, Phase 2, Phase 3 functionality

## Verification Plan

Run production build and test:

1. **Studio global navigation appears once** (via `AppSidebar` only)
2. **Studio chapter panel appears once** (via `StudioLayout` → `AppLayout` → `AppSidebar` → `contextualSidebar`)
3. **Chapter switching works** in Studio
4. **MainLayout still works** (book reader view with chapter list)
5. **Mobile navigation works** (both Studio and MainLayout)
6. **Global audio playback remains functional** (GlobalPlayer, persistence)
7. **Other authenticated pages have no sidebar regressions**
8. **Browser console has no new errors or React warnings**

## Completion Report Required
List changed files and actual test results for each verification step.

## Open Questions
- [ ] Confirm `MainLayout` is used for book reading (not Studio) and needs chapter list
- [ ] Verify no other components import `Sidebar` (grep confirms only 2 usages: StudioLayout, MainLayout)