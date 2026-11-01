# Studio Sidebar Regression Plan

## Root Cause
The `StudioLayout` component (and `Dashboard.jsx`'s legacy structure) is injecting the full `Sidebar` (which includes redundant navigation and branding) alongside the global `AppLayout` (which already has an `AppSidebar`).

## Corrected Hierarchy
- `AppLayout`: Contains the `GlobalPlayer` and the unified `AppSidebar`.
- `StudioLayout`:
    - Wraps the main Studio workspace (Transcript, ReadAlong, etc.).
    - Injects the `ChapterListPanel` (refactored from `Sidebar.jsx`) into `AppLayout`'s `contextualSidebar` slot.
- `ChapterListPanel`: A specialized component that *only* handles current book/chapter state, removed of redundant global navigation and top-level branding.

## File-by-file Correction
1. **`client/src/components/layout/ChapterListPanel.jsx`**: Create a new component containing only the book/chapter list logic (lines 117-165 of the original `Sidebar.jsx`).
2. **`client/src/components/layout/StudioLayout.jsx`**: Update to pass `ChapterListPanel` into the `contextualSidebar` prop of `AppLayout`.
3. **`client/src/components/layout/Sidebar.jsx`**: Delete this file once the ChapterListPanel logic is migrated.
4. **`client/src/pages/Dashboard.jsx`**: Verify Studio integration with the new `StudioLayout`.

## Verification
- Confirm that global navigation appears only once (via `AppLayout`/`AppSidebar`).
- Confirm book/chapter list appears correctly in the sidebar context of the Studio.
- Verify Studio workspace dimensions.
- Confirm full regression test suite (playback, generation, export).

---
**Approval Requested**: Proceed with creating `ChapterListPanel.jsx` and refactoring `StudioLayout.jsx`?
