# Studio Sidebar Fix Plan

## Root Cause Analysis
- `StudioLayout` currently renders a full `Sidebar` component (`client/src/components/layout/Sidebar.jsx`) inside `AppLayout`'s `contextualSidebar` slot.
- `Sidebar.jsx` contains both top-level navigation items (Studio, My Books, Audio Library, Settings) and brand headers, duplicating the exact items rendered by the global `AppSidebar`.
- This causes double sidebars on the Studio page.

## Proposed Solution Architecture

### 1. Create `client/src/components/layout/ChapterListPanel.jsx`
Extract only the book metadata and chapter list portion of the legacy `Sidebar.jsx`:
- Book title, cover initials, chapter count.
- Scrollable list of chapters with status dots, sequence numbers, titles, and reading time estimates.
- `onChapterSelect` callback.
- No global navigation items (`NAV_ITEMS`), no brand header, and no redundant footer.

### 2. Update `client/src/components/layout/StudioLayout.jsx`
- Replace `Sidebar` import with `ChapterListPanel`.
- Pass necessary props (`book`, `activeChapterIdx`, `onChapterSelect`) directly to `ChapterListPanel`.

### 3. Verify & Clean Up `Sidebar.jsx`
- Search for any remaining imports of `Sidebar` across the codebase.
- Once confirmed unused, remove `client/src/components/layout/Sidebar.jsx`.

## File-by-File Change Plan

| File | Action | Description |
|---|---|---|
| `client/src/components/layout/ChapterListPanel.jsx` | Create | Contains only the current book and chapter list UI. |
| `client/src/components/layout/StudioLayout.jsx` | Modify | Imports `ChapterListPanel` instead of `Sidebar`. |
| `client/src/components/layout/Sidebar.jsx` | Delete | Removes the duplicated global + local sidebar component. |

## Verification Plan
1. Run `npm run build` to verify clean imports and zero prop mismatches.
2. Confirm global navigation renders exactly once via `AppSidebar`.
3. Confirm Studio chapter panel renders exactly once via `StudioLayout`.
