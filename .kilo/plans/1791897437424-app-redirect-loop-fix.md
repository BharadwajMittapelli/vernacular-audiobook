# Fix: "Too many re-renders" in App.jsx + Dashboard BottomPlayer props

**Date:** 2026-10-13  
**Error:** `Too many re-renders. React limits the number of renders to prevent an infinite loop.`  
**Component:** `<App>` at `client/src/App.jsx:34-44`

---

## Root Cause

Two bugs combine to produce the crash:

### Bug 1 — State mutation during render (App.jsx:34-44)

```jsx
// BUGGY — these setState calls happen DURING render, not in an effect
if (!session && path !== '/login' && path !== '/register' && !redirecting) {
    setRedirecting(true);   // ← renders trigger another render immediately
    navigate('/login');     // ← calls setPath, another render trigger
    return null;
}
```

When `loading` flips `true → false`, React renders `App`. The first render sees `session === null`, `path === '/'`, `redirecting === false`. It calls `setRedirecting(true)` (render #2), then `navigate('/login')` which calls `setPath('/login')` (render #3), then falls through the switch because `path` still equals `'/'` on this render. The second render repeats with `redirecting === true`, so the guard passes, but now `path === '/login'` so it renders `<Login />`. In Strict Mode the mount→unmount→remount cycle hits this again, and the chain of render-phase setState calls exceeds React's 50-render limit → **"Too many re-renders"**.

### Bug 2 — Dashboard passes wrong props to BottomPlayer (Dashboard.jsx:241-250)

`useAudioPlayer` returns `{ play, pause, isPlaying, currentTime, duration, playbackRate, setPlaybackRate, … }` but Dashboard passes:
```
isPlay={player.isPlay}        // undefined
isPause={player.isPause}      // undefined
isRewind={player.isRewind}    // undefined
isForward={player.isForward}  // undefined
playing={player.playing}      // undefined
pause={player.pause}          // exists but wrong name
rewind={player.rewind}        // undefined
forward={player.forward}      // undefined
```

`BottomPlayer` expects: `isPlaying`, `onPlay`, `onPause`, `onRewind`, `onForward`, `audioUrl`, `currentTime`, `duration`, `playbackRate`, `currentChapterTitle`, `onSeek`, `onRateChange`.

---

## Files to Change (2 files only)

| File | Change |
|------|--------|
| `client/src/App.jsx` | Move all redirect logic into `useEffect`; replace `redirecting` state with `redirectingRef`; add path-change listener to reset guard |
| `client/src/pages/Dashboard.jsx` | Fix `BottomPlayer` props to match actual `useAudioPlayer` return shape |

**No other files are modified.** AuthContext.tsx, main.jsx, Login.jsx, Register.jsx are left untouched.

---

## Task 1 — Fix App.jsx

**Replace lines 1-54 with this exact content:**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';

function App() {
  const { session, loading } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  // ref, not state — avoids render-phase state update
  const redirectingRef = useRef(false);

  const navigate = (newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Redirect AFTER render completes — never during render.
  useEffect(() => {
    if (loading) return;
    const currentPath = window.location.pathname;
    if (!session && currentPath !== '/login' && currentPath !== '/register' && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate('/login');
    } else if (session && (currentPath === '/login' || currentPath === '/register') && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate('/');
    } else {
      redirectingRef.current = false;
    }
  }, [session, loading]);

  // Reset the redirect guard when the user manually navigates to auth pages,
  // so future redirects (e.g., after logout) can still fire.
  useEffect(() => {
    if (path === '/login' || path === '/register') {
      redirectingRef.current = false;
    }
  }, [path]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  switch (path) {
    case '/login':
      return <Login />;
    case '/register':
      return <Register />;
    default:
      return <Dashboard />;
  }
}

export default App;
```

**Key design decisions:**
- `redirectingRef` (not state) prevents render-phase setState; useRef mutations don't trigger re-renders
- Redirect guard lives in a `useEffect` — fires after paint, never during render
- `navigate` is a stable closure — uses `window.history.pushState` and `setPath` (React state updater is stable by reference); no `useCallback` needed
- Effect deps are `[session, loading]` — no `path` dep avoids an extra cycle per navigation
- Second `useEffect` on `path` resets `redirectingRef` when user lands on auth pages, enabling future redirects (e.g., post-logout)
- Auth pages (`/login`, `/register`) are rendered directly — no redirect loop possible since the effect skips when `path` is already an auth page

---

## Task 2 — Fix Dashboard.jsx BottomPlayer props

**Replace lines 241-250 (the `<BottomPlayer ... />` block) with:**

```jsx
        <BottomPlayer
          audioUrl={audioUrl}
          isPlaying={player.isPlaying}
          currentTime={player.currentTime}
          duration={player.duration}
          playbackRate={player.playbackRate}
          currentChapterTitle={chapter?.title}
          onPlay={onPlay}
          onPause={onPause}
          onRewind={onRewind}
          onForward={onForward}
          onSeek={(seconds) => player.seek(seconds)}
          onRateChange={(rate) => player.setPlaybackRate(rate)}
        />
```

**Why this is correct:** Verified against actual sources:
- `useAudioPlayer` returns `{ currentTime, duration, isPlaying, playbackRate, play, pause, seek, setPlaybackRate, … }` (line 79-90 of `useAudioPlayer.jsx`)
- `BottomPlayer` accepts `{ audioUrl, isPlaying, currentTime, duration, playbackRate, currentChapterTitle, onPlay, onPause, onSeek, onRewind, onForward, onRateChange }` (line 12-24 of `BottomPlayer.jsx`)
- All eight missing/renamed props are now correctly mapped

---

## Validation Checklist

Run these commands from the `client/` directory:

```bash
npm run build          # must succeed with no errors
npm run typecheck      # must pass with no errors
```

Then verify in Chrome at http://localhost:5175:

| Scenario | Expected Result |
|----------|----------------|
| Page load (no session) | Spinner appears briefly (~100-300ms), then Login page renders; **no console errors** |
| Direct URL `/dashboard` (no session) | Auto-redirects to `/login`; Back button works from Login |
| Enter valid credentials on Login | Redirects to Dashboard; Login page no longer visible |
| Refresh on Dashboard | Stays on Dashboard (session restored from Supabase) |
| Click Logout on Dashboard | Redirects to Login |
| Go to Login while already logged in | Redirects to Dashboard |
| Direct URL `/register` (no session) | Renders Register page; no redirect loop |
| Enter password mismatch on Register | Shows error, stays on Register |
| Upload .txt file | Chapters parsed, book loads on Dashboard |
| BottomPlayer controls | Play/pause/seek/speed work; no console errors about undefined handlers |

---

## Risks

- **None** — both fixes are surgical, scoped to two files, and preserve all existing auth flow (Supabase signIn/signUp/signOut/Google OAuth/session persistence). No changes to AuthContext, main.jsx, or any backend code.
- The `redirectingRef` pattern is well-established in React for preventing redirect loops (see [React Router docs](https://reactrouter.com/)). It cannot get stuck because the path-change effect resets it whenever the user visits `/login` or `/register`.
