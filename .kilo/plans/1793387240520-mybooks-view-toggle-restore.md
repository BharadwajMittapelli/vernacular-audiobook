# My Books UI Regression Fix — Restore View Toggle Implementation Plan

## Context Summary
- Current `client/src/pages/MyBooks.jsx` was refactored to `AppLayout` with ActionCards and grid-only rendering. `viewMode` state exists but is unused, search input is missing, and grid/list toggle UI is gone.
- Previous implementation (commit fb0f836 and parent 740464f) had tabs → search bar + Grid/List toggle in top-right → conditional grid vs list rendering. List rows showed cover/initials, title, chapter count, status, Open/Share/Delete actions.
- BookCard props: `book, onOpen, onDelete, onShare, deleting`. No prop changes allowed.

## Decisions
- Keep current AppLayout structure with page heading, ActionCards Create Audiobook/Publish, existing tabs, and book collection.
- Preserve existing tabs as currently implemented; do not reintroduce Recent if it has been removed. Current working tree includes Bookshelf, Recent, Shared, Favorites.
- Search and view toggle row placed immediately below tabs, search input expands full width, toggle buttons right-aligned.
- View mode persistence via `localStorage` key `ekithab-mybooks-view` with values `grid`/`list`. Safe default `grid`.
- Grid view uses existing `BookCard` unchanged; Grid remains default.
- List view rendered inline in `MyBooks.jsx` reusing existing book data and callbacks `onOpen`, `onDelete`, `onShare`. No new dependencies.
- Search works identically in both views using existing `searchQuery` state and current filtering logic applied after bookshelf/recent split.

## File-by-File Changes

### client/src/pages/MyBooks.jsx
1. **State init with persistence**
   - Initialize `viewMode` from localStorage:
     `useState(() => localStorage.getItem('ekithab-mybooks-view') === 'list' ? 'list' : 'grid')`
   - `useEffect` to save `viewMode` to localStorage on change.
2. **UI additions**
   - Add search + toggle row immediately below tabs, before book collection:
     - Flex container `flex items-center gap-3 mb-6`
     - Search input with leading Search icon, placeholder `Search books and series...`, value `searchQuery`, onChange setSearchQuery, class `flex-1 min-w-[200px] relative` and input `w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40`
     - View toggle container right-aligned: `flex items-center border border-border rounded-lg overflow-hidden`
     - Grid button: `onClick={()=>setViewMode('grid')}`, active class `bg-terracotta/10 text-terracotta`, icon `<Grid>`
     - List button: `onClick={()=>setViewMode('list')}`, border-left, same active logic, icon `<List>`
3. **Conditional rendering**
   - Replace single grid render with:
     `viewMode === 'grid' ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">...BookCard...</div> : <div className="space-y-3">...list rows...</div>`
   - List row structure:
     - Outer: `flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow`
     - Cover: `w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-terracotta/10 flex items-center justify-center text-terracotta font-bold text-sm` with img or initials `book.title.slice(0,2).toUpperCase()`
     - Info: title `text-sm font-semibold truncate`, subtitle `text-xs text-muted-foreground` with `${book.total_chapters} chapter(s)`, status badge using same `getStatusColor/getStatusLabel` mapping as BookCard
     - Actions: `Open` button `onOpen`, `Share` button `onShare` if supported, `Delete` button with `deleting` spinner and existing confirmation, `Download` button if `book.status==='completed'` reusing `exportBookMp3` and `logExport` flow from BookCard. Keep styling consistent with warm ivory/terracotta system.
4. **Search integration**
   - Existing `searchQuery` state already filters `displayBooks`. Ensure input is rendered so filtering is user-accessible.
5. **Preservation**
   - Do not modify upload, create, publish, recent page, sidebar, audio context, player, auth, backend.
   - Keep existing `tabsWithCounts`, `bookshelfBooks`, `recentBooksFull`, `displayBooks` logic.

### client/src/components/books/BookCard.jsx
- No changes. Props verified compatible.

## Validation Steps
1. Grid view displays all expected books with BookCard.
2. List view displays same books with cover, title, chapters, status, Open action.
3. Toggle switches instantly without refetch.
4. Active state styling visible on selected button.
5. Search filters both views.
6. Bookshelf/Recent tabs filter correctly in both views.
7. Open navigates to `/?bookId=...`.
8. Delete confirmation works in both views.
9. Share dialog opens.
10. View preference persists after refresh via localStorage.
11. Empty state renders in both views.
12. Responsive layout works.
13. Production build has no console errors.

## Risks & Mitigations
- List view download logic duplication: mirror BookCard export flow locally to avoid prop mismatch.
- Status badge styling: reuse same color mapping as BookCard `getStatusColor/getStatusLabel` or inline equivalent.
- Search input placement conflicts with ActionCards: place below tabs to match screenshot position.
- localStorage access in SSR: guard with `typeof window !== 'undefined'` in initializer.

## Open Questions
- None blocking; implementation can proceed with inline list row as above.
