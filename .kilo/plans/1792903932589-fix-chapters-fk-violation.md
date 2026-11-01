# Plan: Fix Studio ←→ My Books Navigation

## Root Cause (Confirmed from Source Inspection)

### Bug 1: `MyBooksSidebar.jsx` Studio click ignores sessionStorage

**File**: `client/src/components/books/MyBooksSidebar.jsx`, lines 6 and 46

```javascript
// Line 6 — Studio has bare route '/' (no bookId awareness)
{ label: 'Studio', icon: Mic, href: '/' },

// Line 46 — Click handler calls onNavClick('/') directly
onClick={() => !isExternal && onNavClick?.(item.href)}
```

When Studio is clicked from My Books, `navigate('/')` is called with no `bookId`. This:
1. Clears the URL (removes any `?bookId` if present)
2. Sets `path = '/'` in App
3. App's redirect effect sees `!hasBookId` → redirects back to `/my-books`

**Contrast with main `Sidebar.jsx`** (lines 78-94): Already handles this correctly by reading `sessionStorage.getItem('lastBookId')` and navigating to `/?bookId=<id>`. `MyBooksSidebar` does NOT have this logic.

### Bug 2: `App.jsx` unstable `navigate` causes redundant effect re-runs

**File**: `client/src/App.jsx`, lines 13-16 and 38

```javascript
const navigate = (newPath) => { ... };  // new reference every render
...
}, [session, loading, path, navigate]);  // triggers on every render
```

While the `!hasBookId` guard prevents incorrect redirects when `bookId` is present, the unstable `navigate` causes the redirect effect to re-run on every render unnecessarily. This creates timing windows where intermediate state can cause unexpected behavior during rapid navigation.

## Fix: Two Changes

### Change 1: Fix `MyBooksSidebar.jsx` Studio click (PRIMARY FIX)

**File**: `client/src/components/books/MyBooksSidebar.jsx`

Update the `onClick` handler to read `lastBookId` from sessionStorage when clicking Studio, mirroring the main `Sidebar.jsx` logic:

Replace line 46:
```javascript
onClick={() => !isExternal && onNavClick?.(item.href)}
```

With:
```javascript
onClick={() => {
    if (isExternal) return;
    if (item.href === '/') {
        const remembered = sessionStorage.getItem('lastBookId');
        if (remembered) {
            onNavClick?.('/?bookId=' + remembered);
            return;
        }
        // No remembered book — stay on My Books
        return;
    }
    onNavClick?.(item.href);
}}
```

### Change 2: Stabilize `navigate` in `App.jsx`

**File**: `client/src/App.jsx`

Import `useCallback` and wrap `navigate`:
```javascript
import React, { useState, useEffect, useCallback } from 'react';
...
const navigate = useCallback((newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
}, []);
```

This eliminates unnecessary effect re-runs. The `navigate` reference is now stable across renders, so the redirect effect only runs when `session`, `loading`, or `path` actually change.

## Storage Verification

Dashboard stores the last successful book at `sessionStorage.lastBookId` (line 210):
```javascript
sessionStorage.setItem('lastBookId', bookId);
```

Dashboard clears it only on confirmed 404 (lines 219-221):
```javascript
if (currentBookIdRef.current === bookId) {
    sessionStorage.removeItem('lastBookId');
}
```

Navigating to My Books does NOT clear it. ✅

## Files Changed

| File | Change | Lines |
|---|---|---|
| `client/src/components/books/MyBooksSidebar.jsx` | Studio click reads sessionStorage | 46 |
| `client/src/App.jsx` | Stabilize `navigate` with `useCallback` | 1, 13-16 |

**No other files changed.** Dashboard.jsx and Sidebar.jsx fixes from previous commits are preserved.

## Navigation Flow (After Fix)

```
My Books → Click Studio
  → sessionStorage has lastBookId='abc123'
  → onNavClick('/?bookId=abc123')
  → App: pushState('/?bookId=abc123'), setPath('/')
  → App redirect: hasBookId=true → NO redirect
  → Dashboard mounts → reads ?bookId from URL → loads book ✅
```

## Validation Checklist

| # | Test | Expected |
|---|---|---|
| 1 | Open book A → Studio shows book A | Book loads in Studio |
| 2 | Click My Books → Click Studio | Reopens book A |
| 3 | Open book B → My Books → Studio | Reopens book B (not A) |
| 4 | Refresh Studio | Book reloads from URL |
| 5 | Browser Back from Studio → My Books | My Books renders |
| 6 | Browser Forward → Studio | Book reopens |
| 7 | Click Studio with no previous book | Stays on My Books (no error) |
| 8 | Frontend build | `npm run build` succeeds |
| 9 | Upload/delete/audit unchanged | All existing functionality preserved |
