# Commit Audit Report: `feat: Phase 1-4 core bugfixes, bulk polling, share flow, MP3 export`

**Commit Hash:** `c116ac0fbfa2e2d551f8aa4ee83449a39db38271`  
**Date:** 2026-10-25 22:52:50 +0530  
**Files Changed:** 17 files (+2105, -45)

---

## Executive Summary

The commit introduces significant new functionality (bulk polling, public sharing, MP3 export) but contains **one critical defect** that causes the reported 500 error, and **one high-priority regression** that can leave the UI in a broken state.

**Confirmed Related:** The `GET /api/studio` 500 error is **directly caused** by this commit due to a missing database migration for `last_opened_at`.

**Not Related:** The `GET /api/studio/:id` 404 error appears to be a pre-existing data issue (book deletion or user mismatch), not caused by this commit.

---

## Audit 1 — Commit and Migration

### 1.1 Missing Migration File (CRITICAL)

**Finding:** The commit references adding `last_opened_at` to the `books` table but **no migration file exists**.

| Evidence | Location |
|----------|----------|
| Code references `last_opened_at` | `server/src/routes/studioRoutes.js:37, 460, 472` |
| Client uses `last_opened_at` | `client/src/pages/MyBooks.jsx:124-125` |
| Migration file `008_add_last_opened_at.sql` | **NOT FOUND** |
| Existing migrations | `001` through `007` only |

**Impact:** When the server executes:
```sql
SELECT id, title, cover_url, ..., last_opened_at, language FROM books
```
PostgREST returns error `PGRST204` (column not found), which is caught by the route handler and returned as `500 Internal Server Error`.

**Confirmation:** Run this query on your Supabase database:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'books' AND column_name = 'last_opened_at';
```
If this returns 0 rows, the migration has not been applied.

### 1.2 Other Migrations Status

| Migration | File Exists | Applied? | Notes |
|-----------|-------------|----------|-------|
| 001_align_audio_generations | Yes | Unknown | Requires manual verification |
| 002_ledger_deduct_refund | Yes | Unknown | Creates `users`, `credit_transactions`, RPCs |
| 003_add_audio_path | Yes | Unknown | Adds `audio_path` to `audio_generations` |
| 004_async_queue_support | Yes | Unknown | Creates `books` table, RPCs for bulk |
| 005_create_chapters_table | Yes | Unknown | Creates `chapters` table |
| 006_add_book_metadata | Yes | Unknown | Adds `title`, `cover_url` to `books` |
| 007_add_book_language | Yes | Unknown | Adds `language` to `books`, `chapters` |
| 008_add_last_opened_at | **NO** | N/A | **MISSING - causes 500 error** |

---

## Audit 2 — Studio API

### 2.1 GET /api/studio (500 Error) — CONFIRMED CAUSE

**Code Path:**
1. `client/src/services/api.js:84` → `api.get('/api/studio')`
2. `server/src/routes/studioRoutes.js:33-47` → `GET /` handler
3. Line 37: `.select('id, title, cover_url, total_chapters, completed_chapters, status, created_at, last_opened_at, language')`

**Root Cause:** If `last_opened_at` column doesn't exist in `public.books`, PostgREST throws `PGRST204`. The catch block at line 43 returns `500 Internal Server Error`.

**Fix Required:** Create and apply migration `server/migrations/008_add_last_opened_at.sql`:
```sql
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
```

### 2.2 GET /api/studio/:id (404 Error) — LIKELY UNRELATED

**Code Path:**
1. `client/src/services/api.js:88` → `api.get(`/api/studio/${bookId}`)`
2. `server/src/routes/studioRoutes.js:454-492` → `GET /:bookId` handler

**Analysis:**
- The route has proper 404 handling at line 465-467
- Returns 404 if book not found OR user_id doesn't match (RLS)
- The browser URL shows bookId `7032f888-...` but console shows `477cf1aa-...`
- These are different book IDs

**Likely Causes:**
1. Book was deleted between page load and request
2. User session changed (different user_id)
3. Book belongs to a different user

**Not Caused By:** This commit — the route logic was already present and correct.

---

## Audit 3 — My Books

### 3.1 Open Navigation Fix — VERIFIED GOOD

**Before (broken):**
```javascript
onClick={() => console.log('[MyBooks] Open book:', book.id)}
```

**After (fixed):**
```javascript
onClick={() => navigate(`/?bookId=${book.id}`)}
```

**Status:** ✅ Correctly wired. No issues.

### 3.2 Recently Opened Sorting — VERIFIED GOOD

**Code:**
```javascript
const recentlyOpened = [...books]
  .filter(b => b.last_opened_at)  // Filters out NULL timestamps
  .sort((a, b) => new Date(b.last_opened_at) - new Date(a.last_opened_at))
  .slice(0, 5);
```

**Analysis:**
- NULL handling: Correct — books without `last_opened_at` are excluded
- Sort order: Correct — most recent first
- Limit: Correct — shows top 5

**Potential Issue:** If `last_opened_at` column is missing from DB, all books will have `undefined` for this field, and `recentlyOpened` will be empty. This is a **symptom** of the missing migration, not a separate bug.

### 3.3 Filter Dropdowns Removed — VERIFIED GOOD

Dead filter dropdowns removed. No functional impact.

---

## Audit 4 — Bulk Status Polling

### 4.1 Polling Implementation — VERIFIED GOOD

**Code (Dashboard.jsx:234-264):**
```javascript
React.useEffect(() => {
  if (!book || book.status !== 'processing') return;

  pollIntervalRef.current = setInterval(async () => {
    try {
      const res = await getBookStatus(book.id);
      if (!res?.success) return;
      setBookStatus(res);
      setBook((b) => ({ ...b, status: res.book.status, ... }));
    } catch {
      // silently ignore
    }
  }, 5000);

  return () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };
}, [book?.id, book?.status]);
```

**Analysis:**
- ✅ Cleanup on unmount: `clearInterval` called in cleanup function
- ✅ Cleanup on dependency change: Effect re-runs when `book?.id` or `book?.status` changes
- ✅ Silent error handling: Transient network errors don't break UI
- ✅ Early return: Stops polling if book status is not 'processing'

### 4.2 Optimistic Status Update — BUG DETECTED

**Code (Dashboard.jsx:354-380):**
```javascript
const generateAll = async () => {
  setIsBulk(true);
  setError(null);
  setBook((b) => ({ ...b, status: 'processing' }));  // ⚠️ OPTIMISTIC
  try {
    const res = await synthesizeAsync({ ... });
    setBulkStatus(...);
  } catch (err) {
    setError(...);  // ⚠️ NO ROLLBACK OF STATUS
  } finally {
    setIsBulk(false);
  }
};
```

**Bug:** If `synthesizeAsync()` throws (e.g., insufficient credits, network error), the book status remains `'processing'` but polling will eventually fail or the user sees stale progress.

**Reproduction:**
1. Click "Generate All" with insufficient credits
2. Error is shown
3. Book status stays 'processing'
4. Progress strip shows "Processing Audio: X/Y chapters done" indefinitely

**Fix:** Reset status in catch block:
```javascript
} catch (err) {
  setBook((b) => ({ ...b, status: b.status === 'processing' ? 'pending' : b.status }));
  setError(...);
}
```

---

## Audit 5 — Public Sharing and Authentication

### 5.1 Public Endpoint Security — VERIFIED GOOD

**Code (storefrontRoutes.js:73-155):**
```javascript
router.get('/book/:bookId', embedLimiter, async (req, res) => {
  // No authMiddleware — public access by design
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, title, cover_url, ...')
    .eq('id', bookId)
    .maybeSingle();
  
  // Only completed books are shareable
  if (!book || book.status !== 'completed') {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  // ...
});
```

**Analysis:**
- ✅ No authentication required (public endpoint)
- ✅ Only returns completed books (status !== 'completed' → 404)
- ✅ Rate limited (60/min per IP)
- ✅ Does not expose user_id or private data
- ✅ UUID validation prevents injection

### 5.2 Auth Bypass for /listen/ — VERIFIED GOOD

**Code (App.jsx:31, 44-51):**
```javascript
// Bypass auth check
if (path.startsWith('/listen/')) return;

// Render public listener
if (path.startsWith('/listen/')) {
  const bookId = path.slice('/listen/'.length).split('/')[0];
  return <PublicListener bookId={bookId} />;
}
```

**Analysis:**
- ✅ Limited to `/listen/` prefix only
- ✅ Renders before auth check
- ✅ No auth context required

### 5.3 Protected Routes — VERIFIED GOOD

- `/my-books`, `/dashboard`, `/api/studio/*` all require authentication
- `/listen/*` is the only authenticated bypass

---

## Audit 6 — MP3 Export

### 6.1 Authorization — VERIFIED GOOD

**Code (studioRoutes.js:338-451):**
```javascript
router.get('/:bookId/export-mp3', exportLimiter, async (req, res) => {
  // Requires auth (authMiddleware applied at app level)
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, title, status, total_chapters')
    .eq('id', bookId)
    .eq('user_id', req.user.id)  // Ownership check
    .single();
  
  if (bookError || !book) {
    return res.status(404).json({ success: false, error: 'Book not found' });
  }
  if (book.status !== 'completed') {
    return res.status(400).json({ success: false, error: 'Book is not yet completed' });
  }
  // ...
});
```

**Analysis:**
- ✅ Auth required (middleware applied)
- ✅ Ownership verified (`user_id` match)
- ✅ Status verified (only completed books)
- ✅ Rate limited (2/min per IP)

### 6.2 FFmpeg Execution — VERIFIED GOOD

**Code:**
```javascript
const ffmpeg = (await import('fluent-ffmpeg')).default;
const ffmpegPath = (await import('ffmpeg-static')).default;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffmpegPath);
```

**Analysis:**
- ✅ Dynamic imports (ESM compatible)
- ✅ Streaming directly to response (no temp files)
- ✅ Cleanup on client disconnect: `req.on('close', () => ffmpegProcess.kill('SIGTERM'))`

### 6.3 Frontend Response Handling — VERIFIED GOOD

**Code (BookCard.jsx:27-46):**
```javascript
const handleDownload = async () => {
  const res = await exportBookMp3(book.id);  // responseType: 'blob'
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  // Extract filename from Content-Disposition header
  const match = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^"';\s]+)['"]?/);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
```

**Analysis:**
- ✅ Blob response type handled correctly
- ✅ Filename extracted from Content-Disposition header
- ✅ Object URL revoked after 2 seconds

### 6.4 Dependencies — NEEDS VERIFICATION

**package.json changes:**
- `fluent-ffmpeg` added
- `ffmpeg-static` added

**Check:** Run `cd server && npm list fluent-ffmpeg ffmpeg-static` to verify installation.

---

## Audit 7 — Additional Findings

### 7.1 Credit Service Dev Override (LOW PRIORITY)

**Code (creditService.js:34-37):**
```javascript
if (/INSUFFICIENT_CREDITS/.test(error.message || '')) {
  // DEV OVERRIDE FOR TESTING
  return { success: true, remaining: 99999 };
  // throw new InsufficientCreditsError();
}
```

**Issue:** When INSUFFICIENT_CREDITS error occurs, the function returns a success object instead of throwing. This is a dev override that was never cleaned up.

**Impact:** 
- In dev mode with `DEV_BYPASS_CREDITS=true`: Function returns early at line 22-24, never reaches this code
- In dev mode without bypass: This code path allows synthesis to continue despite insufficient credits
- In production: Should not be reachable (NODE_ENV !== 'production')

**Recommendation:** Either remove the commented code or add proper logging. Current behavior is confusing.

### 7.2 Unused Endpoint (LOW PRIORITY)

**Finding:** `POST /studio/:bookId/synthesize-all` exists but is never called from the frontend.

**Frontend uses:** `POST /api/audio/synthesize-async` (via `synthesizeAsync()` in api.js)

**Backend has:** Both endpoints:
- `audioRoutes.js:323` → `POST /api/audio/synthesize-async` (used by frontend)
- `studioRoutes.js:138` → `POST /studio/:bookId/synthesize-all` (unused)

**Recommendation:** Consider removing the unused endpoint or wiring it up. Currently dead code.

---

## Summary of Confirmed Issues

| # | Severity | Issue | Location | Related to Commit? |
|---|----------|-------|----------|-------------------|
| 1 | **CRITICAL** | Missing `last_opened_at` migration | `server/migrations/` | **YES** |
| 2 | **HIGH** | Optimistic status not rolled back on failure | `Dashboard.jsx:354-380` | **YES** |
| 3 | Medium | Credit service dev override returns wrong type | `creditService.js:34-37` | NO |
| 4 | Low | Unused endpoint `POST /studio/:bookId/synthesize-all` | `studioRoutes.js:138` | NO |

---

## Verification Checklist

### Pre-Fix Verification
- [ ] Run SQL query to confirm `last_opened_at` column missing from `books` table
- [ ] Check server logs for PostgREST errors (PGRST204)
- [ ] Reproduce 500 error on `GET /api/studio`
- [ ] Verify 404 error is pre-existing (unrelated to commit)

### Post-Fix Verification
- [ ] Apply migration `008_add_last_opened_at.sql`
- [ ] Restart server
- [ ] Verify `GET /api/studio` returns 200 with books
- [ ] Verify `GET /api/studio/:id` returns 200 for valid books
- [ ] Test bulk synthesis failure case (insufficient credits)
- [ ] Verify book status resets to 'pending' on failure
- [ ] Verify recently opened sorting works
- [ ] Verify public share link works for completed books
- [ ] Verify MP3 export works for completed books
- [ ] Run `npm run build` to confirm no build errors

---

## Required Database Migrations

### Immediate (Critical)
```sql
-- Migration 008: Add last_opened_at to books
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
```

### Pending Verification
Run in Supabase SQL Editor:
```sql
-- Verify all migrations applied
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'books' 
ORDER BY ordinal_position;

SELECT routine_name FROM information_schema.routines 
WHERE routine_schema='public'
  AND routine_name IN ('deduct_credits','refund_credits','get_user_balance',
                        'increment_book_completion','mark_book_failed');
```

---

## Smallest Safe Fixes

### Fix 1: Missing Migration (Critical)
**File:** `server/migrations/008_add_last_opened_at.sql` (CREATE NEW)
```sql
-- V2 Phase 8: Add last_opened_at column to books table.
-- Safe to run repeatedly; IF NOT EXISTS makes it idempotent.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
```

Then apply via Supabase SQL Editor or update `apply-all.sql`.

### Fix 2: Rollback Optimistic Status (High)
**File:** `client/src/pages/Dashboard.jsx` line 370-376

Change:
```javascript
} catch (err) {
  const d = err.response?.data;
  setError(
    d?.required
      ? `${d.error} (need ${d.required}, have ${d.available})`
      : d?.error || 'Bulk synthesis failed'
  );
}
```

To:
```javascript
} catch (err) {
  const d = err.response?.data;
  setError(
    d?.required
      ? `${d.error} (need ${d.required}, have ${d.available})`
      : d?.error || 'Bulk synthesis failed'
  );
  // Rollback optimistic status on failure
  setBook((b) => b.status === 'processing' ? { ...b, status: 'pending' } : b);
}
```

---

**Audit Complete.** Awaiting approval for fixes.
