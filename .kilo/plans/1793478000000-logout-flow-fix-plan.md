# Logout Flow Fix Plan

## Root Cause Analysis

The logout flow has a **race condition** and **improper navigation**:

### Current Implementation (AppSidebar.jsx:58)
```jsx
<button onClick={() => { signOut(); window.location.href = '/'; }}>
```

**Problems:**
1. **Race condition**: `signOut()` is async but `window.location.href = '/'` fires immediately without waiting
2. **Full page reload**: Uses `window.location.href` instead of SPA navigation
3. **No error handling**: If signOut fails, user is still redirected
4. **App.jsx redirect conflict**: After logout, App.jsx sees unauthenticated user on `/` and may redirect to `/auth`

### AuthContext signOut (AuthContext.tsx:92-99)
```typescript
const signOut = async () => {
  try {
    await supabase.auth.signOut();
  } finally {
    setSession(null);
    setError(null);
  }
};
```
- Sets session to null immediately after Supabase signOut
- Does NOT return a promise that resolves when complete (though it is async)
- No error propagation

### App.jsx Redirect Logic (lines 33-43)
```typescript
if (!session && path !== '/auth' && path !== '/') {
  navigate('/auth');  // Redirects to /auth, not /
}
```
- LandingPage at `/` IS accessible without auth
- But after logout, the forced reload to `/` might trigger redirect to `/auth`

## Why Bookshelf "Disappears"

1. **Books are in database, not localStorage** - they persist
2. **MyBooks fetches books on mount** via `getBooks()` API
3. **Issue**: If logout redirect goes to `/auth` instead of `/`, user sees login page, not LandingPage
4. **After re-login**: MyBooks re-fetches books → they should appear (if API works)

## Files to Change

| File | Issue | Fix |
|------|-------|-----|
| `client/src/components/layout/AppSidebar.jsx` | Logout uses `window.location.href` without waiting for signOut | Wait for signOut, use navigate callback |
| `client/src/context/AuthContext.tsx` | signOut doesn't return completion properly | Ensure proper async completion |

## Proposed Fix

### 1. AppSidebar.jsx - Fix logout handler
- Pass `onNavigate` or use existing `onNavClick` for logout
- Wait for `signOut()` to complete before navigating
- Navigate to `/` (LandingPage) not `/auth`

### 2. AuthContext.tsx - Ensure signOut completes properly
- Return promise from signOut
- Handle errors properly

## Verification Steps

1. Start dev server
2. Sign in → go to `/my-books`
3. Click logout in sidebar
4. Verify redirect to `/` (LandingPage)
5. Verify no authenticated sidebar visible
6. Click "Sign in" → log in again
7. Verify redirect to `/my-books`
8. Verify bookshelf loads with existing books
9. Verify chapters, audio library, studio still work
10. Test logout from other pages (Settings, Audio Library, etc.)

## Regression Risks

| Risk | Mitigation |
|------|------------|
| Breaking SPA navigation | Use existing navigate function |
| Session not cleared | Verify setSession(null) happens |
| Redirect loops | Ensure LandingPage `/` is accessible without auth |
| Books not loading after login | MyBooks already fetches on mount |

## Open Questions

1. Should logout clear `usePlaybackPersistence` localStorage keys? (Probably yes, user-specific)
2. Should GlobalPlayer state be reset on logout? (Probably yes)
3. Is there a shared `navigate` function we can use instead of `onNavClick`?

## Minimal Changes

1. **AppSidebar.jsx**: Change logout to use `onNavClick('/')` after awaiting signOut
2. **AuthContext.tsx**: Ensure signOut returns awaited promise
3. **AppLayout.jsx** (if needed): Pass navigate function to AppSidebar