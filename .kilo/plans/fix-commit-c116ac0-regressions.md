# Implementation Plan: Fix Commit c116ac0 Regressions

## Scope

Three items to address:
1. **Fix 1 (Critical):** Missing `last_opened_at` migration causing `GET /api/studio` 500
2. **Fix 2 (High):** Bulk synthesis failure leaves UI stuck in processing state
3. **Investigation (Separate):** Trace the 404 discrepancy between browser URL bookId and request bookId

**Out of scope:** Auth rules, credit logic, public sharing, MP3 export, unrelated migrations, dev credit override, unused endpoint.

---

## Fix 1 — Missing `last_opened_at` Migration

### Problem
`server/src/routes/studioRoutes.js:37, 460` selects `last_opened_at` from `public.books`, but no migration file `008_add_last_opened_at.sql` exists in `server/migrations/`. The column was never added to the database. PostgREST returns `PGRST204` (column not found), caught by the route handler, returned as `500 Internal Server Error`.

### Files to Change

**1. Create `server/migrations/008_add_last_opened_at.sql`**
```sql
-- V2 Phase 8: Add last_opened_at column to books table.
-- Safe to run repeatedly; IF NOT EXISTS makes it idempotent.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
```

**2. Update `server/migrations/apply-all.sql`** — append the new migration SQL before the mock-user seed block.

### Verification After Fix
- Run the migration in Supabase SQL Editor (project `sgpkxgwnxusjagjnesir`):
  ```sql
  ALTER TABLE public.books ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
  ```
- Confirm column exists:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'last_opened_at';
  ```
  Expected: 1 row returned.
- Restart the backend server.
- Confirm `GET /api/studio` returns `200` with book list (not 500).
- Confirm `GET /api/studio/:bookId` returns `200` for a valid book.

---

## Fix 2 — Bulk Synthesis Failure State Rollback

### Problem
`Dashboard.jsx:354-380` — `generateAll()` optimistically sets `book.status = 'processing'` before calling `synthesizeAsync()`. If the API call throws (insufficient credits, network error, etc.), the catch block sets the error message and `isBulk = false`, but **never resets `book.status`**. The UI remains stuck showing "Processing Audio: X/Y chapters" indefinitely.

### Current Code (lines 354–380)
```javascript
const generateAll = async () => {
  setIsBulk(true);
  setError(null);
  setBook((b) => ({ ...b, status: 'processing' }));
  try {
    const res = await synthesizeAsync({
      chapters: book.chapters.map((ch) => ({ ... })),
    });
    setBulkStatus(`Queued ${res.queued}, cached ${res.cached} of ${res.totalChapters} chapters`);
  } catch (err) {
    const d = err.response?.data;
    setError(
      d?.required
        ? `${d.error} (need ${d.required}, have ${d.available})`
        : d?.error || 'Bulk synthesis failed'
    );
  } finally {
    setIsBulk(false);
  }
};
```

### Change — Add status rollback in catch block

**File:** `client/src/pages/Dashboard.jsx`  
**Location:** lines 370–376 (the catch block)

Add one line inside the catch block, **after** `setError(...)` and **before** the closing `}`:

```javascript
  } catch (err) {
    const d = err.response?.data;
    setError(
      d?.required
        ? `${d.error} (need ${d.required}, have ${d.available})`
        : d?.error || 'Bulk synthesis failed'
    );
    // Rollback optimistic status so stale processing indicators stop
    setBook((b) => b.status === 'processing' ? { ...b, status: 'pending' } : b);
  }
```

### Why this is safe
- Uses functional updater `setBook((b) => ...)` — reads latest state, not stale closure
- Only rolls back if `status === 'processing'` — if a newer server-poll has already updated to `completed`/`failed`, that state is preserved (the ternary returns `b` unchanged)
- Error message and `setIsBulk(false)` in `finally` are untouched
- Polling cleanup (lines 258–263) continues to work — when `book.status` changes away from `'processing'`, the effect cleanup runs and stops polling

### Edge case considered
**What if the server successfully started processing but the frontend request failed (timeout)?**  
In that case the book IS processing on the server, and rolling back to `pending` would be incorrect. However, `synthesizeAsync` creates the book on the server before returning — if the response comes back (202 Accepted), we never enter the catch block. If the network times out before a response, the server may have started work, but this is an unlikely edge case and the alternative (stuck in processing forever) is worse UX. The user can manually navigate away and back to refresh.

---

## Investigation 3 — Studio Detail 404 Discrepancy

### Observed Behavior
- **Browser URL:** `localhost:5175/?bookId=7032f888-1346-43ca-b134-d21c25b65d6e`
- **Console error:** `GET /api/studio/477cf1aa-5b4d-481b-be0b-379db40e5405` → 404

Two different book IDs. Need to determine if this is expected or a bug.

### Code Path Trace

**How `lastBookId` flows:**
1. `Dashboard.jsx:212` — on successful load: `sessionStorage.setItem('lastBookId', bookId)`
2. `Dashboard.jsx:221-223` — on 404: `if (currentBookIdRef.current === bookId) sessionStorage.removeItem('lastBookId')`
3. `MyBooksSidebar.jsx:50-53` — Studio click: reads `sessionStorage.getItem('lastBookId')`, navigates to `/?bookId=<remembered>`
4. `Sidebar.jsx:86-88` — same pattern for main sidebar

**Dashboard mount behavior:**
- `Dashboard.jsx:164-231` — single `useEffect` with `[]` dependency (runs once on mount)
- Reads `bookId` from `window.location.search` at mount time
- Makes `getBookDetails(bookId)` call
- **No effect watches for URL changes** — Dashboard never re-fetches when `?bookId` changes while mounted

### Likely Explanation

The 404 request for `477cf1aa-...` is a **stale in-flight request from a previous session**:

1. User previously opened book `477cf1aa-...` → stored in sessionStorage as `lastBookId`
2. That book was later deleted (by user or admin)
3. User navigated to a different book `7032f888-...` via direct link or bookshelf
4. Browser URL now shows `7032f888-...`
5. The 404 for `477cf1aa-...` is a **historical network request** that completed after the user had already navigated away

**Or alternatively:** The `lastBookId` in sessionStorage still holds the old deleted book ID. When the user clicks Studio from My Books, it navigates to the stale ID first (triggering the 404), then the user manually navigates to the correct book.

### Evidence Against This Being a Bug in This Commit
- The `lastBookId` / sessionStorage mechanism was introduced in commit `b3b60f9` ("fix(studio): reopen last opened book")
- The 404 handling in Dashboard (`:219-223`) correctly clears `lastBookId` on confirmed 404
- The `currentBookIdRef` guard prevents clearing a newer book's ID when an older stale request completes
- The navigation code in `MyBooksSidebar.jsx` and `Sidebar.jsx` simply reads from sessionStorage — it cannot produce a wrong ID

### Recommended Investigation Steps (Read-Only)
1. Check browser sessionStorage: `window.sessionStorage.getItem('lastBookId')` — if it returns `477cf1aa-...`, the stale-ID theory is confirmed
2. Check browser Network tab: sort requests by timestamp — confirm the 404 request for `477cf1aa-...` happened **before** the successful request for `7032f888-...`
3. Check if book `477cf1aa-...` exists in the database:
   ```sql
   SELECT id, title, status FROM public.books WHERE id = '477cf1aa-5b4d-481b-be0b-379db40e5405';
   ```
   If 0 rows → book was deleted, explaining the 404.

### Potential Follow-Up Fix (If Confirmed as Bug)
If the investigation confirms that clicking Studio from MyBooks navigates to a stale/deleted book ID, the fix would be:
- In `MyBooksSidebar.jsx:50-53` and `Sidebar.jsx:86-88`, validate the remembered ID before navigating (e.g., check if it matches the currently loaded book, or skip navigation if no valid book is remembered).
- **This is deferred** until the investigation confirms it's a real user-facing bug rather than a one-time stale request.

---

## File Change Summary

| File | Change | Type |
|------|--------|------|
| `server/migrations/008_add_last_opened_at.sql` | **CREATE** — new migration file | Fix 1 |
| `server/migrations/apply-all.sql` | Append migration 008 SQL | Fix 1 |
| `client/src/pages/Dashboard.jsx` | Add status rollback in `generateAll` catch block | Fix 2 |

**Total: 3 files changed, 0 files deleted.**

---

## Verification Checklist

### Fix 1
- [ ] Migration file `008_add_last_opened_at.sql` created with correct SQL
- [ ] `apply-all.sql` updated to include migration 008
- [ ] Migration applied to Supabase (manual SQL Editor or script)
- [ ] `GET /api/studio` returns 200 with book list
- [ ] `GET /api/studio/:bookId` returns 200 for valid book
- [ ] Recently opened sorting shows books with `last_opened_at` set

### Fix 2
- [ ] `Dashboard.jsx` catch block includes status rollback line
- [ ] Successful bulk generation still works (status stays processing → completed)
- [ ] Failed bulk generation (e.g., insufficient credits) resets status to pending
- [ ] Progress strip disappears when generation fails
- [ ] `isBulk` flag still cleared in `finally` block

### Investigation 3
- [ ] Check sessionStorage for stale `lastBookId`
- [ ] Check Network tab timestamps for 404 vs successful request
- [ ] Check if book `477cf1aa-...` exists in database
- [ ] Report findings (no code changes unless bug confirmed)

### Build
- [ ] `npm run build` passes with no errors
- [ ] TypeScript typecheck passes

---

## Rollout Notes
- Migration is idempotent (`IF NOT EXISTS`) — safe to run repeatedly
- No schema changes to existing columns
- No API contract changes
- Frontend change is a single-line addition in error handling path
- Safe to deploy without downtime
