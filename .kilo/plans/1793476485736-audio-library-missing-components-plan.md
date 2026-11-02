# AudioLibrary Missing Components Diagnostic & Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the Vite build error caused by two missing component files (`FavoritesView.jsx` and `ByBookView.jsx`) that are imported but not implemented in the audioLibrary directory.

**Architecture:** The AudioLibrary page uses a tab-based layout with four views: All Audio (AudioTable), By Book (ByBookView — missing), Favorites (FavoritesView — missing), and Downloads (DownloadsView). Both missing components should render chapter lists using the same `AudioRow` component and follow the established visual pattern of `AudioTable`. The server-side APIs for favorites and by-book already exist and return properly shaped data.

**Tech Stack:** React 18, Vite, Tailwind CSS, lucide-react icons

**Spec:** N/A — this is a bug-fix plan. The interface contracts are defined by how `AudioLibrary.jsx` consumes these components.

## Global Constraints

- Components must be placed at `client/src/components/audioLibrary/FavoritesView.jsx` and `client/src/components/audioLibrary/ByBookView.jsx`
- Both must use `AudioRow.jsx` from the same directory for row rendering
- Both must follow the established loading/empty/error states used by `AudioTable.jsx` and `DownloadsView.jsx`
- No server changes required — `/api/library/favorites` and `/api/library/by-book` routes already exist and return valid data
- The `favorites` prop on `FavoritesView` is a `Set<string>` of chapterIds (created in AudioLibrary.jsx before passing)

## Review Focus

1. Empty state when no favorites/chapters exist — must show a friendly empty message, not crash
2. Loading state while API data is being fetched — must show spinner without layout shift
3. Prop contract mismatch — `items` prop shape must match what `AudioRow` expects (`chapterId`, `chapterTitle`, `bookTitle`, `coverUrl`, `language`, `voiceName`, `flag`, `langName`, `durationSeconds`, `createdAt`, `sequenceNumber`, `bookId`)
4. Favorite toggle interaction — must call `onFavoriteToggle(chapterId, bookId)` with the correct arguments
5. Book filtering in ByBookView — chapters within each book should display in sequence order

---

## Task 1: Create `FavoritesView.jsx`

**Files:**
- Create: `client/src/components/audioLibrary/FavoritesView.jsx`
- Modify: None

**Interfaces:**
- Consumes: `AudioRow` (default export style named import), `Loader2`, `AlertCircle`, `Heart` from lucide-react
- Produces: `FavoritesView` component with props `{ items, activeChapterId, isPlaying, onPlay, onSelect, onFavoriteToggle, loading }`

- [ ] **Step 1: Scaffold the component file**

Create `client/src/components/audioLibrary/FavoritesView.jsx` with the following interface:

```jsx
import React from 'react';
import { AudioRow } from './AudioRow.jsx';
import { Loader2, AlertCircle, Heart } from 'lucide-react';

export function FavoritesView({
  items,
  activeChapterId,
  isPlaying,
  onPlay,
  onSelect,
  onFavoriteToggle,
  loading = false,
}) { ... }
```

- [ ] **Step 2: Implement loading state**

When `loading` is true, render:
```jsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
  <p className="text-sm text-muted-foreground">Loading favorites…</p>
</div>
```

- [ ] **Step 3: Implement empty state**

When `!loading && items.length === 0`, render:
```jsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
    <Heart className="h-7 w-7 text-muted-foreground" />
  </div>
  <h3 className="text-base font-semibold text-foreground">No favorites yet</h3>
  <p className="text-sm text-muted-foreground mt-1">
    Tap the heart icon on any chapter to save it here.
  </p>
</div>
```

- [ ] **Step 4: Implement list rendering**

When items exist, render a `<div className="space-y-1">` containing one `AudioRow` per item, using the same props pattern as `AudioTable.jsx`:

```jsx
{items.map((item) => (
  <AudioRow
    key={item.chapterId}
    item={item}
    isActive={activeChapterId === item.chapterId}
    isPlaying={isPlaying}
    isFavorite={true}  // all items in this view are favorites
    onPlay={onPlay}
    onSelect={onSelect}
    onFavoriteToggle={onFavoriteToggle}
  />
))}
```

Note: `items` arrives from `AudioLibrary.jsx` already enriched (same shape as playback history items) with fields: `chapterId`, `chapterTitle`, `bookId`, `bookTitle`, `coverUrl`, `language`, `durationSeconds`, `audioUrl`, `createdAt`, `bookLastOpenedAt`, `voiceName`, `flag`, `langName`. Pass them directly to `AudioRow`.

- [ ] **Step 5: Verify**

Confirm the file exists at `client/src/components/audioLibrary/FavoritesView.jsx` and contains a named export `FavoritesView`.

---

## Task 2: Create `ByBookView.jsx`

**Files:**
- Create: `client/src/components/audioLibrary/ByBookView.jsx`
- Modify: None

**Interfaces:**
- Consumes: `AudioRow` from `./AudioRow.jsx`
- Produces: `ByBookView` component with props `{ books, activeChapterId, isPlaying, onPlay, onSelect, onFavoriteToggle, loading }`

- [ ] **Step 1: Understand the data shape**

`books` prop is an array of objects returned from `GET /api/library/by-book` (server line 359-366):
```js
{
  bookId,
  bookTitle,
  coverUrl,
  lastPlayedAt,
  playedChaptersCount,
  totalChapters,
  chapters: [
    { chapterId, chapterTitle, sequenceNumber, lastPlayedAt, durationSeconds, language }
  ]
}
```

The chapters do NOT include `voiceName`, `flag`, `langName`, or `createdAt` — these must be derived or provided defaults.

- [ ] **Step 2: Scaffold the component file**

Create `client/src/components/audioLibrary/ByBookView.jsx`:

```jsx
import React from 'react';
import { AudioRow } from './AudioRow.jsx';
import { Loader2, BookOpen } from 'lucide-react';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME } from './AudioRow.jsx';

export function ByBookView({
  books,
  activeChapterId,
  isPlaying,
  onPlay,
  onSelect,
  onFavoriteToggle,
  loading = false,
}) { ... }
```

- [ ] **Step 3: Implement loading state**

When `loading` is true, render the same Loader2 spinner pattern as FavoritesView.

- [ ] **Step 4: Implement empty state**

When `!loading && books.length === 0`, render:
```jsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
    <BookOpen className="h-7 w-7 text-muted-foreground" />
  </div>
  <h3 className="text-base font-semibold text-foreground">No books yet</h3>
  <p className="text-sm text-muted-foreground mt-1">
    Generate an audiobook in Studio to see it here.
  </p>
</div>
```

- [ ] **Step 5: Implement book-grouped chapter list**

Render each book as a section with a header and its chapters as rows:

```jsx
{books.map((book) => (
  <div key={book.bookId} className="mb-6">
    {/* Book header */}
    <div className="flex items-center gap-3 mb-2 px-4">
      <div className="w-8 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.bookTitle} className="w-full h-full object-cover" />
        ) : (
          (book.bookTitle || '').slice(0, 2).toUpperCase()
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{book.bookTitle}</h3>
        <p className="text-xs text-muted-foreground">
          {book.playedChaptersCount} of {book.totalChapters} chapters played
        </p>
      </div>
    </div>

    {/* Chapters */}
    <div className="ml-4 space-y-1 border-l-2 border-border pl-4">
      {book.chapters.map((ch) => {
        const language = ch.language || 'en-IN';
        const item = {
          chapterId: ch.chapterId,
          chapterTitle: ch.chapterTitle,
          bookId: book.bookId,
          bookTitle: book.bookTitle,
          coverUrl: book.coverUrl,
          language,
          durationSeconds: ch.durationSeconds,
          createdAt: ch.lastPlayedAt,
          sequenceNumber: ch.sequenceNumber,
          voiceName: DEFAULT_VOICE_BY_LANG[language] || 'Kaveri',
          flag: LANGUAGE_FLAG[language] || '🇮🇳',
          langName: LANGUAGE_NAME[language] || 'English',
        };
        return (
          <AudioRow
            key={ch.chapterId}
            item={item}
            isActive={activeChapterId === ch.chapterId}
            isPlaying={isPlaying}
            isFavorite={false}
            onPlay={onPlay}
            onSelect={onSelect}
            onFavoriteToggle={onFavoriteToggle}
          />
        );
      })}
    </div>
  </div>
))}
```

Note: `ByBookView` does NOT receive a pre-computed `favoriteItems` set — it receives raw `books`. The `isFavorite` prop should be `false` for all rows since this view doesn't track favorites status. (The `toggleFavorite` callback from AudioLibrary still works via `onFavoriteToggle` if needed, but this view has no favorite indicator.)

- [ ] **Step 6: Verify**

Confirm the file exists at `client/src/components/audioLibrary/ByBookView.jsx` and contains a named export `ByBookView`.

---

## Task 3: Verify the build resolves

- [ ] **Step 1: Confirm both files exist**

Run: `ls client/src/components/audioLibrary/`

Expected: `FavoritesView.jsx` and `ByBookView.jsx` both present.

- [ ] **Step 2: Run Vite dev server**

Run: `cd client && npm run dev`

Expected: No `[plugin:vite:import-analysis]` errors. The overlay should disappear.

- [ ] **Step 3: Verify Favorites tab**

Navigate to Audio Library → click "Favorites" tab. Expected: Shows either the empty state ("No favorites yet") or a list of favorited chapters with heart icons filled.

- [ ] **Step 4: Verify By Book tab**

Navigate to Audio Library → click "By Book" tab. Expected: Shows books grouped with their chapters, each chapter row clickable to play.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `items` shape mismatch between AudioLibrary and AudioRow | AudioRow reads `item.chapterId`, `item.chapterTitle`, `item.bookTitle`, `item.coverUrl`, `item.language`, `item.voiceName`, `item.flag`, `item.langName`, `item.durationSeconds`, `item.createdAt`, `item.sequenceNumber` — both views can satisfy this |
| `ByBookView` chapters lack `voiceName`/`flag`/`langName` | Derive from `ch.language` using the same `DEFAULT_VOICE_BY_LANG`, `LANGUAGE_FLAG`, `LANGUAGE_NAME` exports from `AudioRow.jsx` |
| Vite HMR cache | If errors persist after creating files, restart the dev server |

## Validation Plan

- [ ] Vite dev server starts without `import-analysis` errors
- [ ] Favorites tab renders without crashes when empty and when populated
- [ ] By Book tab renders without crashes when empty and when populated
- [ ] Clicking play on a favorite chapter triggers `onPlay` callback
- [ ] Clicking heart on a favorite chapter triggers `onFavoriteToggle` callback
- [ ] By Book chapter rows sort by `sequenceNumber` within each book (handled server-side at line 363)
