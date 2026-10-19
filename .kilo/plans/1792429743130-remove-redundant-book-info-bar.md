# Plan: Remove Redundant Book-Information Bar

## Context
Project: Ekithab AI / Vernacular Audiobook
Working directory: /Users/vamshikrishna/vernacular-audiobook

Inspected Studio layout:
- `client/src/components/layout/TopBar.jsx` renders top toolbar. Center flex-1 section displays `book.title` and `Chapter XX — chapter.title` or “No book loaded”.
- Main book header with cover, chapter title, chapter counter and previous/next controls lives in `client/src/pages/Dashboard.jsx` studioContent, `Book header` at lines 288-319:
  - Cover placeholder, `book?.title`, `chapter?.title`, `Ch. {activeIdx + 1} / {book?.chapters?.length}` and navigation buttons.
- `MainLayout.jsx` passes `book`, `chapter`, `activeIdx` to TopBar.

The TopBar center information is duplicated by the main book header and is redundant.

## Objective
Remove the redundant horizontal information bar that displays book title, chapter number and chapter title from the top toolbar while preserving main header, toolbar controls, sidebar, and all completed UI work including Task 1.

## Files to modify
- `client/src/components/layout/TopBar.jsx`
Optional related adjustment:
- `client/src/components/layout/MainLayout.jsx` only if props are removed to avoid dead props.

## Proposed changes

### TopBar.jsx
1. Remove the central information block:
   - Delete `<div className="flex-1 min-w-0">...</div>` containing:
     ```jsx
     {book ? (
       <div className="flex items-baseline gap-2 overflow-hidden">
         <span className="text-sm font-semibold truncate">{book.title}</span>
         <span className="text-muted-foreground text-xs shrink-0">
           Chapter {String(activeIdx + 1).padStart(2, '0')} — {chapter?.title}
         </span>
       </div>
     ) : (
       <span className="text-sm text-muted-foreground">No book loaded</span>
     )}
     ```
   - Keep left menu button and right control group unchanged.
2. Layout adjustment:
   - Header remains `flex items-center px-4 gap-3`. Removing the flex-1 spacer allows menu button to sit left and control group to sit right with no empty strip.
3. Props cleanliness:
   - `book`, `chapter`, `activeIdx` become unused after removal. Option A: leave props in signature to avoid changing `MainLayout.jsx`. Option B: remove unused props from signature and from `MainLayout.jsx` call. Choose Option A for minimal change unless dead-prop removal is deemed essential.
4. No imports to remove. No backend changes.

Preserve:
- New Upload button, Configure button, Notifications button, profile avatar with terracotta styling from Task 1.
- `onMenuClick`, `onLoadNewBook`, `onOpenConfig` handlers.
- Authentication integration and sign-out behavior.

## Decisions
- Target component is TopBar only. Main book header in Dashboard remains untouched.
- Minimal change: remove rendering block only, keep props signature to avoid cascading changes.
- No new dependencies or global token changes.

## Risks / Edge cases
- Removing flex-1 spacer may shift right controls leftward; layout should remain clean with existing gap.
- If props are left unused, no functional impact but dead props remain. Acceptable for minimal change.
- Ensure “No book loaded” text removal does not leave stray spacing.

## Validation plan
- Redundant book title/chapter bar is gone from top toolbar.
- Main book header with cover, chapter title, chapter counter, previous/next controls remains visible in Studio.
- Top toolbar controls still work: New Upload, Configure, Notifications, profile avatar sign-out.
- Sidebar navigation and chapter selection preserved.
- No unexplained empty strip remains in top bar.
- Frontend production build passes `npm run build` with no type errors.
- Task 1 changes preserved: voice cards single column, avatar terracotta.

## Out of scope
- Backend, API, Supabase, database, environment changes.
- Modifying main book header or Dashboard layout beyond spacing adjustment.
- Adding dependencies or changing global color tokens.

## Open questions
None; redundant bar location confirmed in TopBar center section.
