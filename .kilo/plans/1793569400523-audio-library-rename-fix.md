# Audio Library — Rename Sync & By Book Navigation Fix

## Context

Two bugs in the Audio Library chapter-renaming feature:

1. **Delayed title updates** — renaming a chapter in All Audio doesn't update the UI immediately; requires page refresh.
2. **By Book crash** — clicking `>` on a book card throws `ReferenceError: onChapterUpdate is not defined`.

## Root Causes

### Bug 1: AudioTable doesn't forward onChapterUpdate

`AudioTable.jsx` receives `onChapterUpdate` from `AudioLibrary.jsx` (line 256) but never accepts it in its prop destructuring or passes it down to `AudioRow`. So when `AudioRow.handleSave()` calls `onChapterUpdate(updatedChapter)`, the callback is `undefined` and the parent state never updates.

### Bug 2: ByBookView doesn't forward onChapterUpdate to BookCard

`ByBookView.jsx` destructures `onChapterUpdate` from its props (line 13) and passes it to `ChapterRow` (line 106), but the prop is never forwarded from `ByBookView` to `BookCard` (lines 36-42). When the book card expands and renders `ChapterRow`, `onChapterUpdate` is undefined in that scope.

## Changes Required (2 files only)

### File 1: `client/src/components/audioLibrary/AudioTable.jsx`

**Line 5-19:** Add `onChapterUpdate` to the destructured props.

```diff
 export function AudioTable({
   items,
   activeChapterId,
   isPlaying,
   onPlay,
   onSelect,
   searchQuery,
   bookFilter,
   loading = false,
   error = null,
   onRetry,
   isFavorite,
   onFavoriteToggle,
   selectedChapterId,
+  onChapterUpdate,
 }) {
```

**Line 108-118:** Pass `onChapterUpdate` to each `AudioRow`.

```diff
   return (
     <div className="space-y-1 overflow-x-hidden">
       {/* Header */}
       ...
       {filtered.map((item) => (
         <AudioRow
           key={item.chapterId}
           item={item}
           isActive={activeChapterId === item.chapterId}
           isPlaying={isPlaying}
           isSelected={selectedChapterId === item.chapterId}
           isFavorite={isFavorite ? isFavorite(item.chapterId) : false}
           onPlay={onPlay}
           onSelect={onSelect}
           onFavoriteToggle={onFavoriteToggle}
+          onChapterUpdate={onChapterUpdate}
         />
       ))}
     </div>
   );
```

### File 2: `client/src/components/audioLibrary/ByBookView.jsx`

**Lines 34-42:** Pass `onChapterUpdate` to `BookCard`.

```diff
       {books.map((book) => (
         <BookCard
           key={book.bookId}
           book={book}
           activeChapterId={activeChapterId}
           isPlaying={isPlaying}
           onPlay={onPlay}
           onSelect={onSelect}
           onFavoriteToggle={onFavoriteToggle}
+          onChapterUpdate={onChapterUpdate}
         />
       ))}
```

## Why These Are the Only Changes Needed

- `AudioLibrary.jsx` already defines `onChapterUpdate` handlers for both `AudioTable` (line 256) and `ByBookView` (line 275), using correct property names (`updatedChapter.id`, `updatedChapter.title`) matching the API response shape `{ id, book_id, sequence_number, title, status }`.
- `AudioRow.jsx` already calls `onChapterUpdate(updatedChapter)` after successful rename — it just never received the prop.
- `ByBookView.jsx` ChapterRow already calls `onChapterUpdate(updatedChapter)` — it just never received the prop from BookCard.
- `PlayerPanel.jsx` reads from `displayChapter` which is derived from `items` state — once `setItems` is called in AudioLibrary, PlayerPanel re-renders automatically.

## Data Flow After Fix

```
All Audio rename:
  AudioRow.handleSave() → API PUT → onChapterUpdate(updatedChapter)
  → AudioLibrary.setItems() → All Audio table re-renders
  → PlayerPanel re-renders (displayChapter updated)
  → By Book view unaffected (different state: byBookData)

By Book rename:
  ChapterRow.handleSave() → API PUT → onChapterUpdate(updatedChapter)
  → AudioLibrary.setByBookData() + setItems() → both views re-render
  → PlayerPanel re-renders (displayChapter updated)
  → All Audio also reflects change
```

## Validation Steps

1. Open Audio Library → All Audio. Rename a chapter → Enter. Confirm immediate update in table and PlayerPanel.
2. Switch to By Book tab. Confirm renamed chapter shows new title.
3. Click `>` on a book card. Confirm chapters expand without error.
4. Rename a chapter inside expanded By Book view. Confirm update in both All Audio and By Book.
5. Refresh page. Confirm titles persist (backend working).
6. Test Escape cancels editing. Test empty title rejected. Test failed save preserves original.

## Risk Assessment

- **Low risk:** Only prop threading, no logic changes.
- **No backend changes.**
- **No UI design changes.**
- **No new dependencies.**
