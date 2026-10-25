# Phase 1: DB Sync & Core Bug Fixes — Implementation Plan

## Goal
Apply pending DB migrations, wire real `last_opened_at` tracking, fix dead list-view navigation, surface backend synthesis progress, and clean up stale UI stubs in `MyBooks`.

## Decisions (confirmed)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Use existing RPCs (`increment_book_completion`, `mark_book_failed`) for book-level status | Already present; queue worker already uses them |
| D2 | Update `last_opened_at` from a single GET endpoint (`/api/studio/:bookId`) | All entry paths to Studio already call it; no need to touch list endpoint |
| D3 | Include `last_opened_at` + `status` in `GET /studio` response | UI shows status badges on cards; avoids a second round-trip |
| D4 | Strip three dead `<select>` filters; keep working search + grid/list toggle | No filtering backend support; dead UI adds noise |
| D5 | Keep "Shared" / "Favorites" tabs rendered as "coming soon" placeholders | Out of scope for this sprint |

## Affected files

- `server/src/routes/studioRoutes.js`
- `client/src/pages/MyBooks.jsx`
- `client/src/components/books/RecentlyOpenedCard.jsx` *(read-only check)*

## Step-by-step tasks

### 1. Database ✅ (already executed)
- `last_opened_at TIMESTAMPTZ` on `public.books` — applied via MCP (`008_add_last_opened_at`)
- `language` columns + indexes on `books`/`chapters` — already migrated (`007_add_book_language`)
- `chapters` table + `chapter_uuid` FK — already migrated (`005_create_chapters_table`)
- RPCs `increment_book_completion`, `mark_book_failed`, `get_user_balance` — already present

**Open verification:** Run the following query and confirm all 3 RPCs + `last_opened_at` exist:
```sql
SELECT routine_name FROM information_schema.routines WHERE routine_schema='public'
  AND routine_name IN ('increment_book_completion','mark_book_failed','get_user_balance');
SELECT column_name FROM information_schema.columns WHERE table_name='books'
  AND column_name='last_opened_at';
```

### 2. Backend: include `last_opened_at` and `status` in book listings
**File:** `server/src/routes/studioRoutes.js`  
**Location:** `GET /` handler (lines 33–47)

Current `.select()` projection:
```js
select('id, title, cover_url, total_chapters, completed_chapters, status, created_at')
```
Change to:
```js
select('id, title, cover_url, total_chapters, completed_chapters, status, created_at, last_opened_at, language')
```
Also add `language` to `GET /:bookId` projection (line ~296).

### 3. Backend: set `last_opened_at` on book open (fire-and-forget)
**File:** `server/src/routes/studioRoutes.js`  
**Location:** `GET /:bookId` handler (lines 290–318)

After the existing book fetch (line 294–299), insert a **fire-and-forget** update — do NOT `await` it so it does not block frontend hydration:

```js
// Fire and forget
supabase
  .from('books')
  .update({ last_opened_at: new Date().toISOString() })
  .eq('id', bookId)
  .eq('user_id', req.user.id)
  .then(({ error }) => {
    if (error) console.error('Failed to update last_opened_at', error);
  });
```

Also include `last_opened_at` in the `.select()` projection on line 296 (same projection as step 2).

*Note:* This endpoint is called whenever the user navigates to a book from either grid or list view (`/?bookId=...`).

### 4. Frontend: fix list-view "Open" button
**File:** `client/src/pages/MyBooks.jsx`  
**Location:** line 315–320

Replace:
```jsx
onClick={() => console.log('[MyBooks] Open book:', book.id)}
```
With:
```jsx
onClick={() => navigate(`/?bookId=${book.id}`)}
```

### 5. Frontend: create separate `recentlyOpened` array; clean up fake override
**File:** `client/src/pages/MyBooks.jsx`  
**Location:** lines 112–119 (after `sortedBooks`), 346–358 (Recently Opened section)

**DO NOT modify `sortedBooks`** — it must remain sorted by `created_at` for the Bookshelf grid.

1. Add a new `recentlyOpened` array right after `sortedBooks` (after line 119):
   ```js
   const recentlyOpened = [...books]
     .filter(b => b.last_opened_at)
     .sort((a, b) => new Date(b.last_opened_at) - new Date(a.last_opened_at))
     .slice(0, 5);
   ```
2. In the "Recently opened" section (line 348), replace `books.slice(0, 4)` with `recentlyOpened`:
   ```jsx
   {recentlyOpened.map((book) => (
     <RecentlyOpenedCard
       key={book.id}
       book={book}
       onOpen={() => navigate(`/?bookId=${book.id}`)}
     />
   ))}
   ```
3. Remove the `lastOpened: book.created_at` override from the spread — pass `book` as-is.

### 6. Frontend: remove dead filter dropdowns
**File:** `client/src/pages/MyBooks.jsx`  
**Location:** lines 217–225

Delete the three `<select>` elements with `disabled` + `opacity-60`. Keep:
- Search input
- Grid/List toggle

### 7. Frontend: status badge propagation check
**File:** `client/src/components/books/BookCard.jsx` *(already read)*

Status badge is already implemented (lines 4–20, 40–43). Uses `book.status` and renders Done/Processing/Failed/Pending with correct colors. **No change needed.**

### 8. Frontend: recently opened card — no prop rename needed
**File:** `client/src/components/books/RecentlyOpenedCard.jsx` *(already read)*

Card already accepts `book` object and reads `book.title`, `book.cover_url`, `book.total_chapters`. No `lastOpened` prop used. The `lastOpened: book.created_at` override in MyBooks.jsx line 352 is harmless but misleading — remove it so the card naturally displays real `last_opened_at` via the parent's sort order. **No component change needed.**

## Failure modes & rollback
- **`last_opened_at` write fails silently** → fire-and-forget logs to console; UI still works, just no recency sort until next open.
- **`GET /studio` select misses a column** → Supabase throws PGRST200 (project constraint). Keep the projection explicit; do not use `select('*')`.
- **Migration already applied** → idempotent `IF NOT EXISTS`; no-op on re-run.

## Validation
1. `npm run dev` (server + client)
2. Navigate to My Books → verify grid/list both show correct statuses
3. Click any book from list view → should enter Studio (no console.log)
4. Upload/create a book → return to My Books → "Recently opened" should reflect most-recently-opened first
5. Trigger synthesis → watch `status` change from `pending` → `processing` → `completed/failed` on the card
6. Supabase query confirms `last_opened_at` updates:
   ```sql
   SELECT id, title, last_opened_at FROM public.books ORDER BY last_opened_at DESC NULLS LAST LIMIT 5;
   ```

## Out of scope
- Bulk-generation progress UI (Phase 2)
- WebSocket live updates
- Shared/Favorites backend
- Dark mode / theming
- Audio bucket private policy change (separate deploy step)
