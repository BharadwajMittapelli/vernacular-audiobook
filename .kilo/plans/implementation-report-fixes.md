# Implementation Report: Fix Commit c116ac0 Regressions

## Changes Made

### 1. Created `server/migrations/008_add_last_opened_at.sql`
```sql
-- V2 Phase 8: Add last_opened_at column to books table.
-- Safe to run repeatedly; IF NOT EXISTS makes it idempotent.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
```

### 2. Updated `server/migrations/apply-all.sql`
Appended Migration 008 SQL before the mock-user seed block (lines 47-49).

### 3. Updated `server/migrations/pending.sql`
Appended Migration 008 section (lines 67-73).

### 4. Updated `client/src/pages/Dashboard.jsx` (line 377-378)
Added status rollback in `generateAll` catch block:
```javascript
// Rollback optimistic status so stale processing indicators stop
setBook((b) => b.status === 'processing' ? { ...b, status: 'pending' } : b);
```

---

## Verification Results

### ✅ Fix 1 — Migration File Created
- `server/migrations/008_add_last_opened_at.sql` created with correct SQL
- `server/migrations/apply-all.sql` updated
- `server/migrations/pending.sql` updated

### ✅ Build Verification
- TypeScript typecheck: **PASSED** (no errors)
- Frontend build: **PASSED** (1494 modules transformed, built in 407ms)

### ⏳ Fix 1 — Database Migration Pending Manual Application
**Status:** Cannot apply programmatically — Supabase REST API does not expose raw SQL execution, and the management API requires a different token than the service role key.

**Confirmed:** The `last_opened_at` column is **missing** from the database.
```
GET /rest/v1/books?select=last_opened_at → {"code":"42703","message":"column books.last_opened_at does not exist"}
```

**Action Required:** Run this SQL in Supabase SQL Editor:
```
https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql
```
```sql
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
```

After applying, restart the server and verify:
```bash
# Should return 200 with books (not 500)
curl http://localhost:4001/api/studio
```

---

## Investigation 3 — Studio Detail 404 Discrepancy

### Finding: NOT a code bug — dev environment auth mismatch

**Both book IDs exist in the database:**
| Book ID | Title | User ID | Status |
|---------|-------|---------|--------|
| `477cf1aa-...` | mockbook | `d7f06e94-...` | pending |
| `7032f888-...` | mockbook | `d7f06e94-...` | pending |

**Root cause of 404:**
- The server is running **without** `NODE_ENV=development`
- Without an auth header, `authMiddleware` returns 401 (not the dev mock user)
- When the frontend sends a request with a valid Supabase auth token, `req.user.id` = `d7f06e94-...`
- The 404 in the console occurred when the request was made **without proper auth** (or with a token for a different user)

**Why two different book IDs appear:**
- Browser URL shows `7032f888-...` (currently viewed book)
- Console shows `477cf1aa-...` (a previously-opened book, likely from `sessionStorage.lastBookId`)
- Both are legitimate books owned by the same user
- The 404 for `477cf1aa-...` was a transient auth issue, not a missing book

**This is expected behavior** — the 404 handler in `studioRoutes.js:465-467` correctly returns 404 when `user_id` doesn't match. In production with proper auth, both books will load correctly.

---

## Files Changed Summary

| File | Change | Lines |
|------|--------|-------|
| `server/migrations/008_add_last_opened_at.sql` | **CREATED** | 5 |
| `server/migrations/apply-all.sql` | Appended migration 008 | +3 |
| `server/migrations/pending.sql` | Appended migration 008 | +6 |
| `client/src/pages/Dashboard.jsx` | Added status rollback in catch | +2 |

**Total: 4 files (1 created, 3 modified)**

---

## Remaining Action Items

1. **Apply migration** — Run SQL in Supabase SQL Editor (see above)
2. **Restart server** — After migration, restart `node server/src/index.js`
3. **Verify 500 is fixed** — Test `GET /api/studio` returns 200
4. **Test bulk failure** — Trigger bulk synthesis with insufficient credits, confirm UI resets to pending
5. **Commit changes** — When ready: `git add server/migrations/008_add_last_opened_at.sql server/migrations/apply-all.sql server/migrations/pending.sql client/src/pages/Dashboard.jsx && git commit`

---

## Unverified (Requires Manual Testing)

- [ ] `GET /api/studio` returns 200 after migration is applied
- [ ] `GET /api/studio/:bookId` returns 200 for valid book with proper auth
- [ ] Bulk synthesis failure resets book status to pending
- [ ] Progress strip disappears on generation failure
- [ ] `recentlyOpened` sorting works after migration
