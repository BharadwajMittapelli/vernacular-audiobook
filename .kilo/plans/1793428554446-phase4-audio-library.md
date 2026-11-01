# Phase 4: Audio Library Features — Finalized Implementation Plan

## Executive Summary

Complete the remaining Audio Library tabs: **By Book**, **Favorites**, **ContinueListening** improvements, and **Downloads** verification. All playback must route through the existing GlobalPlayer (`AudioContext`).

---

## 1. Current State Audit (Verified)

### Completed (Phases 1–3.1)
| Feature | Status | Key Files |
|---------|--------|-----------|
| Playback History DB/API | ✅ | `playback_history` table, `GET/POST /playback/history`, `GET/POST /playback/log` |
| All Audio UI | ✅ | `AudioLibrary.jsx`, `AudioTable`, `AudioRow`, `PlayerPanel`, `LibraryTopBar` |
| GlobalPlayer Integration | ✅ | `AudioContext.jsx` + `useAudio()` — single `Audio` element |
| ContinueListening | ✅ | Uses `history` prop, shows real progress only for active chapter |
| Downloads | ✅ | `DownloadsView.jsx` — self-contained, uses `/api/library/downloads` |
| By Book Tab | ⚠️ | UI exists (tab + dropdown), shows "Coming soon..." |
| Favorites Tab | ⚠️ | UI exists (tab + heart icon), **no backend**, shows "Coming soon..." |

### Database Schema (Verified)
| Table | Key Columns | FK Relationships |
|-------|-------------|------------------|
| `users` | `id uuid PK`, `email`, `credits` | — |
| `books` | `id uuid PK`, `user_id`, `title`, `cover_url`, `language`, `total_chapters`, `completed_chapters`, `status`, `created_at` | `user_id → users(id)` |
| `chapters` | `id uuid PK`, `book_id`, `user_id`, `sequence_number`, `title`, `text_content`, `char_count`, `estimated_duration_seconds`, `status`, `language`, `created_at` | `book_id → books(id)`, `user_id → users(id)` |
| `audio_generations` | `id uuid PK`, `user_id`, `chapter_id` (text), `chapter_uuid uuid`, `book_id uuid`, `language`, `audio_url`, `audio_path`, `duration`, `alignment`, `status`, `idempotency_key`, `credits_used`, `created_at` | `chapter_uuid → chapters(id)`, `book_id → books(id)`, `user_id → users(id)` |
| `playback_history` | `id uuid PK`, `user_id`, `book_id`, `chapter_id`, `first_played_at`, `last_played_at`, `created_at` | `user_id → users(id)`, `book_id → books(id)`, `chapter_id → chapters(id)` |
| `downloads` | `id uuid PK`, `user_id`, `book_id`, `book_chapter_id`, `book_title`, `book_cover_url`, `file_name`, `file_format`, `file_size_bytes`, `exported_at`, `export_type` | `user_id → auth.users(id)`, `book_id → books(id)` |
| `favorites` | **Does not exist** | — |

### API Endpoints (libraryRoutes.js)
| Method | Path | Status |
|--------|------|--------|
| GET | `/library/all-audio` | ✅ (legacy, used by By Book tab currently) |
| GET | `/library/downloads` | ✅ |
| POST | `/library/downloads/log` | ✅ |
| DELETE | `/library/downloads/:id` | ✅ |
| POST | `/library/playback/log` | ✅ |
| GET | `/library/playback/history` | ✅ |
| **GET** | **`/library/by-book`** | **Missing** |
| **GET/POST/DELETE** | **`/library/favorites`** | **Missing** |

---

## 2. Implementation Requirements

### 2.1 By Book Tab

**New Backend Endpoint:** `GET /api/library/by-book`

**Query Logic:**
```sql
-- Start from playback_history for authenticated user
-- Join books and chapters
-- Group by book_id
-- For each book: aggregate played chapters, sort by last_played_at desc
-- Only include chapters that exist in playback_history
```

**Response Shape:**
```json
{
  "success": true,
  "books": [{
    "bookId": "uuid",
    "bookTitle": "Book Title",
    "coverUrl": "https://...",
    "lastPlayedAt": "2026-10-30T12:00:00Z",
    "playedChaptersCount": 3,
    "totalChapters": 10,
    "chapters": [{
      "chapterId": "uuid",
      "chapterTitle": "Chapter 1",
      "sequenceNumber": 1,
      "lastPlayedAt": "2026-10-30T12:00:00Z",
      "durationSeconds": 1200,
      "language": "en-IN"
    }]
  }]
}
```

**Critical Constraints:**
- `playedChaptersCount` = COUNT of `playback_history` rows for that book
- `totalChapters` = COUNT of all `chapters` for that book (from `books.total_chapters` or direct count)
- Only chapters present in `playback_history` appear in the `chapters` array
- Sort books by `last_played_at` DESC (most recently played book first)
- Sort chapters within each book by `sequence_number` ASC

**Frontend Component:** `ByBookView.jsx`
- Expandable book cards showing played chapters
- Click chapter card → select in PlayerPanel (via existing `onSelect` callback)
- Play button on chapter → GlobalPlayer (via existing `onPlay` callback)
- **No autoplay on selection**
- Reuse `LibraryTopBar` book filter dropdown (already works — receives `uniqueBooks` from parent)

---

### 2.2 Favorites Tab

**Database Migration Required:** `server/migrations/012_create_favorites.sql`

```sql
-- 012_create_favorites.sql
-- Safe to run repeatedly. Verify table existence before applying.

-- Create table if missing
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_user_created_idx ON public.favorites (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Safely create policies (guards against duplicate-policy errors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'favorites' 
      AND policyname = 'favorites_select_own'
  ) THEN
    CREATE POLICY "favorites_select_own" ON public.favorites
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'favorites' 
      AND policyname = 'favorites_insert_own'
  ) THEN
    CREATE POLICY "favorites_insert_own" ON public.favorites
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'favorites' 
      AND policyname = 'favorites_delete_own'
  ) THEN
    CREATE POLICY "favorites_delete_own" ON public.favorites
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;
```

**Backend Endpoints (libraryRoutes.js):**

| Method | Path | Request Body | Response |
|--------|------|--------------|----------|
| GET | `/library/favorites` | — | `{ success: true, favorites: [{ chapterId, bookId, bookTitle, chapterTitle, sequenceNumber, coverUrl, language, durationSeconds, createdAt }] }` |
| POST | `/library/favorites` | `{ bookId, chapterId }` | `{ success: true, favorite: {...} }` |
| DELETE | `/library/favorites/:chapterId` | — | `{ success: true }` |

**Validation Rules:**
- `user_id` derived from authenticated middleware (`req.user.id`) — **never from request body**
- Verify `chapter_id` belongs to `book_id` (join `chapters` table)
- Verify audio generation exists and is completed for that chapter (same as `/playback/log`)
- Unique constraint on `(user_id, chapter_id)` prevents duplicates
- Return 400 if chapter not found, not owned, or no audio generated

**Frontend:**
- **Centralized favorite state** in `AudioLibrary.jsx` — single source of truth
- `favorites` state: `Set<string>` of favorited `chapterId`s
- `favoritesLoaded` state: boolean
- Load favorites on mount via `getFavorites()`
- Provide `toggleFavorite(chapterId, bookId)` callback to children
- Pass `favorites` set and `toggleFavorite` to `AudioRow`, `PlayerPanel`, `FavoritesView`
- **No duplicate favorite state** in individual components

**Components:**
- `FavoritesView.jsx` — list of favorited chapters (similar to `AudioTable` but simpler, no search/filter needed)
- `AudioRow.jsx` — add heart icon button (outline = not favorited, filled = favorited)
- `PlayerPanel.jsx` — repurpose existing heart icon (top-right) as favorite toggle

---

### 2.3 ContinueListening — Improvements

**Current State:** Works correctly — shows real progress only for active chapter.

**Changes:**
1. Add optional `onViewAll` prop (callback)
2. Add "View all →" button in header (currently non-functional)
3. `onViewAll` should set `activeTab = 'all'` in `AudioLibrary.jsx`
4. Visibility: Show on **All Audio** and **By Book** tabs only; hide on Favorites and Downloads

---

### 2.4 Downloads — Verification Only

**Do not modify.** Verify existing functionality:
- [ ] Downloads tab loads and displays packages
- [ ] "Open" button triggers re-download via `exportBookMp3(bookId)`
- [ ] "Remove from Downloads" deletes record
- [ ] Sort dropdown works (newest/oldest)
- [ ] Detail panel shows on selection
- [ ] Loading, empty, error states work
- [ ] No shared state with other tabs (already self-contained)

---

## 3. File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `server/migrations/012_create_favorites.sql` | Favorites table migration |
| `client/src/components/audioLibrary/ByBookView.jsx` | By Book tab component |
| `client/src/components/audioLibrary/FavoritesView.jsx` | Favorites tab component |

### Modified Files
| File | Changes |
|------|---------|
| `server/src/routes/libraryRoutes.js` | Add `GET /by-book`, `GET/POST/DELETE /favorites` |
| `client/src/services/api.js` | Add `getByBook`, `getFavorites`, `addFavorite`, `removeFavorite` |
| `client/src/pages/AudioLibrary.jsx` | Import new views, wire tabs, manage centralized `favorites` state, pass callbacks |
| `client/src/components/audioLibrary/LibraryTopBar.jsx` | No changes needed (already passes `books` for dropdown) |
| `client/src/components/audioLibrary/ContinueListening.jsx` | Add `onViewAll` prop, wire "View all" button |
| `client/src/components/audioLibrary/AudioRow.jsx` | Add `isFavorite` prop and `onFavoriteToggle` callback, render heart icon |
| `client/src/components/audioLibrary/PlayerPanel.jsx` | Repurpose heart icon as favorite toggle, add `isFavorite`/`onFavoriteToggle` props |

---

## 4. Component Prop Contracts

### AudioRow.jsx (Updated)
```jsx
<AudioRow
  item={...}
  isActive={...}
  isPlaying={...}
  isFavorite={favorites.has(item.chapterId)}
  onPlay={...}
  onSelect={...}
  onFavoriteToggle={toggleFavorite}
/>
```

### PlayerPanel.jsx (Updated)
```jsx
<PlayerPanel
  activeChapter={...}
  isPlaying={...}
  progress={...}
  playbackRate={...}
  isFavorite={displayChapter && favorites.has(displayChapter.chapterId)}
  onPlayPause={...}
  onSeek={...}
  onSkip={...}
  onPlaybackRateChange={...}
  onFavoriteToggle={toggleFavorite}
  onDownload={...}
  onOpenStudio={...}
/>
```

### ByBookView.jsx (New)
```jsx
<ByBookView
  books={byBookData}           // from GET /by-book response
  activeChapterId={...}        // from global player or selection
  isPlaying={...}
  onPlay={playChapter}         // existing callback
  onSelect={handleSelectChapter} // existing callback
  onFavoriteToggle={toggleFavorite}
/>
```

### FavoritesView.jsx (New)
```jsx
<FavoritesView
  items={favoriteItems}        // filtered from items where favorites.has(chapterId)
  activeChapterId={...}
  isPlaying={...}
  onPlay={playChapter}
  onSelect={handleSelectChapter}
  onFavoriteToggle={toggleFavorite}
/>
```

---

## 5. Potential Regressions & Mitigations

| Risk | Mitigation |
|------|------------|
| GlobalPlayer sync broken by new tabs | All tabs use same `useAudio()` — no new Audio elements |
| Favorites migration conflicts with existing data | `IF NOT EXISTS`, unique constraint on `(user_id, chapter_id)`, DO blocks for policies |
| By Book shows unplayed chapters | Query starts from `playback_history` only |
| Favorite state out of sync | Centralized in `AudioLibrary.jsx` — single source of truth |
| AudioRow/PlayerPanel heart icon conflicts | Existing heart is decorative — repurpose with clear filled/outline states |
| ContinueListening visibility | Explicit conditional rendering in `AudioLibrary.jsx` |

---

## 6. Implementation Order

1. **Favorites migration** — Apply `012_create_favorites.sql` in Supabase SQL Editor
2. **Favorites backend endpoints** — Add to `libraryRoutes.js`
3. **By Book backend endpoint** — Add to `libraryRoutes.js`
4. **API client methods** — Add to `api.js`
5. **Frontend: ByBookView component** — Create new component
6. **Frontend: FavoritesView component** — Create new component
7. **Update AudioLibrary.jsx** — Wire tabs, add centralized `favorites` state
8. **Update AudioRow.jsx** — Add favorite toggle
9. **Update PlayerPanel.jsx** — Repurpose heart icon as favorite toggle
10. **Update ContinueListening.jsx** — Add `onViewAll` prop
11. **Verify Downloads** — Confirm unchanged
12. **Build + regression test** — `npm run build`, `npx tsc --noEmit`

---

## 7. Validation Plan

| Test | Expected |
|------|----------|
| By Book tab loads | Shows books with played chapters, expandable |
| By Book chapter play | Starts GlobalPlayer, syncs bottom bar |
| By Book chapter select | Updates PlayerPanel, **no autoplay** |
| By Book filter | LibraryTopBar dropdown filters correctly |
| Favorites add/remove | Heart toggles, persists after refresh |
| Favorite synchronization | AudioRow, PlayerPanel, FavoritesView stay synchronized |
| Favorites user isolation | Other users don't see favorites |
| ContinueListening | Real data, visible on All Audio + By Book only |
| "View all" button | Navigates to All Audio tab |
| Downloads tab | Unchanged, fully functional |
| All Audio tab | Completed UI and behavior preserved |
| Studio/Dashboard | No regressions |
| Playback history | No duplicate logging |
| Audio architecture | One existing audio element |
| Build | `npm run build` passes |
| TypeScript | `npx tsc --noEmit` passes |

---

## 8. Approval Checklist

**Before implementation, need explicit approval on:**

1. ✅ **Favorites migration SQL** — As shown in Section 2.2
2. ✅ **By Book API response contract** — As shown in Section 2.1
3. ✅ **Favorites API contracts** — As shown in Section 2.2
4. ✅ **Centralized favorite state in AudioLibrary.jsx** — Single `favorites` Set, passed down
5. ✅ **Heart icon behavior** — Outline = not favorited, Filled = favorited; click toggles
6. ✅ **ContinueListening visibility** — All Audio + By Book only; "View all" → All Audio tab

**No other database changes required. No new migrations beyond 012.**

---

## 9. Ready for Implementation

This plan is complete and ready for implementation. All design decisions are resolved. The implementation can proceed in the order specified in Section 6.