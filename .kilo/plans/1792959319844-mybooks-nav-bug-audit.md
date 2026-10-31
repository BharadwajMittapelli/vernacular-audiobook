# Fix My Books Navigation Regression — Implementation Plan

## Root Causes

### Bug 1: OAuth Redirect Effect Too Aggressive
**File:** `client/src/App.jsx` lines 44–50  
The second redirect effect fires on every path change for authenticated users, overriding navigation to `/settings`, `/audio-library`, and `/?bookId=...`.

### Bug 2: MyBooksSidebar Studio Click Is a No-Op
**File:** `client/src/components/books/MyBooksSidebar.jsx` lines 47–58  
When no `lastBookId` is remembered, the click handler returns without calling `onNavClick`, leaving the user on the same page with no feedback.

---

## Fix 1: App.jsx — Add Guards to OAuth Redirect Effect

**Location:** `client/src/App.jsx`, lines 44–50

**Change:** Add `hasBookId` guard and restrict redirect to bare `/` path only.

```js
// BEFORE (broken):
useEffect(() => {
  if (loading || !session) return;
  if (path.startsWith('/listen/')) return;
  if (path === '/my-books') return;
  navigate('/my-books');
}, [session, loading, path, navigate]);

// AFTER (fixed):
useEffect(() => {
  if (loading || !session) return;
  if (path.startsWith('/listen/')) return;
  if (path === '/my-books') return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('bookId')) return;
  if (path !== '/') return;
  navigate('/my-books');
}, [session, loading, path, navigate]);
```

**Why this works:**
- `path.startsWith('/listen/')` — already excluded public share links
- `path === '/my-books'` — already excluded My Books page
- `params.get('bookId')` — new guard: skip redirect when navigating to a specific book
- `path !== '/'` — new guard: only redirect on bare root (OAuth callback), not on other routes like `/settings` or `/audio-library`

**What is preserved:**
- The first redirect effect (lines 31–42) is unchanged — it handles auth redirects correctly
- Public listener routing is unchanged
- Auth guards are unchanged
- The `/` route still renders `LandingPage` for non-book navigation

---

## Fix 2: MyBooksSidebar.jsx — Restore Original Studio Click Semantics

**File:** `client/src/components/books/MyBooksSidebar.jsx`, lines 47–58

**Root cause:** Commit `53c9342` introduced a no-op when no `lastBookId` is remembered. The pre-bug code simply called `onNavClick?.('/')` for all non-external nav items, which navigated to `/`. App.jsx's redirect effect then sent authenticated users to `/my-books`. The bug made this a silent no-op instead.

**Correction per review:** Do NOT use `onNavClick('/my-books')` as fallback (user is already there). Instead, restore the original semantics by navigating to `/`, which triggers the existing redirect pipeline.

```js
// BEFORE (broken — silent no-op):
onClick={() => {
  if (isExternal) return;
  if (item.href === '/') {
    const remembered = sessionStorage.getItem('lastBookId');
    if (remembered) {
      onNavClick?.('/?bookId=' + remembered);
      return;
    }
    return;  // BUG: silently does nothing
  }
  onNavClick?.(item.href);
}}

// AFTER (fixed — restores original semantics):
onClick={() => {
  if (isExternal) return;
  if (item.href === '/') {
    const remembered = sessionStorage.getItem('lastBookId');
    if (remembered) {
      onNavClick?.('/?bookId=' + remembered);
      return;
    }
    onNavClick?.('/');  // navigates to /, App.jsx redirect sends to /my-books
    return;
  }
  onNavClick?.(item.href);
}}
```

**Why `onNavClick('/')` is correct:**
- Matches the original pre-bug behavior exactly (`onClick={() => !isExternal && onNavClick?.(item.href)}`)
- The `/` route triggers App.jsx's existing redirect effect → sends authenticated users to `/my-books`
- Explicit navigation action, not a silent no-op
- Preserves the full redirect pipeline (auth checks, landing page handling, etc.)
- No new routes or workflows introduced

---

## Files Changed

| File | Lines | Change Type |
|------|-------|-------------|
| `client/src/App.jsx` | 44–50 | Add 2 guard lines to existing useEffect |
| `client/src/components/books/MyBooksSidebar.jsx` | 55 | Replace `return` with `onNavClick?.('/'); return;` |

**Total lines changed:** 2 files, ~4 lines modified.

---

## What Is NOT Changed

- `MyBooks.jsx` — upload and book-opening handlers untouched
- `Sidebar.jsx` (Studio sidebar) — untouched, already correct
- Any backend code
- Any database/migrations
- Any authentication logic
- Any other component props or exports

---

## Verification Checklist

| Check | Expected Result |
|-------|-----------------|
| Click Settings from My Books sidebar | Navigates to `/settings`, stays there |
| Click Audio Library from My Books sidebar | Navigates to `/audio-library`, stays there |
| Click Open on a book from Bookshelf | Navigates to `/?bookId=...`, Dashboard loads the book |
| Click Open on a Recent book | Same as above |
| Upload a book and complete | Navigates to `/?bookId=...`, Dashboard loads the new book |
| Click Studio from My Books sidebar (with remembered book) | Navigates to `/?bookId=<id>`, Dashboard loads that book |
| Click Studio from My Books sidebar (no remembered book) | Navigates to `/`, then App.jsx redirect sends to `/my-books` (same page, explicit navigation) |
| Click Studio from Dashboard sidebar | Reopens last book or falls back to `/my-books` (existing behavior preserved) |
| Browser Back from Settings | Returns to previous page |
| Browser Back from `/?bookId=...` | Returns to `/my-books` |
| Unauthenticated visit to `/settings` | Redirected to `/auth` (existing auth guard preserved) |
| Browser console | No React warnings or prop errors |

---

## Build/Lint

Run after changes:
```bash
cd client && npm run build
cd ../server && node --check src/index.js && node --check src/routes/settingsRoutes.js
cd .. && npm run build:client
```

TypeScript check:
```bash
cd client && npx tsc --noEmit
```

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Breaking Studio sidebar behavior | None — no changes to Sidebar.jsx | Verified via checklist |
| Breaking OAuth redirect | Very low — effect already existed, just adding guards | Guards are narrow: only skip when `bookId` present or path is not `/` |
| Breaking Settings/Audio Library navigation | Low — these currently don't work at all | Fix is additive, only restricts when redirect fires |
| Prop mismatch | None — no component signatures change | Only inline handler logic modified |
