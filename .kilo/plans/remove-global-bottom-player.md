# Remove Global Bottom Player – Audit & Implementation Plan

## Objective
Completely remove the newly introduced Global Bottom Player from all pages and restore original page-specific audio playback behavior: Studio `BottomPlayer` and Audio Library `PlayerPanel` only.

## Audit Findings

### Where GlobalPlayer is mounted
- `client/src/components/layout/AppLayout.jsx:25`
  - `<GlobalPlayer />` is rendered unconditionally inside AppLayout's main column, below `<main>` and before closing `</div>`.
- `AppLayout` is the base layout for:
  - `client/src/pages/Home.jsx:40`
  - `client/src/pages/Recent.jsx:20`
  - `client/src/pages/Settings.jsx:20`
  - `client/src/pages/MyBooks.jsx:267`
  - `client/src/pages/AudioLibrary.jsx:213`
  - `client/src/components/layout/StudioLayout.jsx:15` → used by `client/src/pages/Dashboard.jsx:873`
- No other direct imports of `GlobalPlayer` found.

### What GlobalPlayer does
- `client/src/components/layout/GlobalPlayer.jsx`
  - Subscribes to `AudioContext` via `useAudio()`: `activeChapter`, `isPlaying`, `currentTime`, `duration`, `play`, `pause`, `seek`.
  - Renders a sticky bottom bar with cover, title, prev/play/next, seek slider, volume placeholder.
  - Play button calls `play(activeChapter)`.
  - Returns `null` if `!activeChapter`.

### Original players still present
- Studio
  - `client/src/pages/Dashboard.jsx:881-897` passes a `bottomBar` to `StudioLayout`.
  - `BottomPlayer` component `client/src/components/layout/BottomPlayer.jsx` is rendered inside `StudioLayout` at `client/src/components/layout/StudioLayout.jsx:18`.
  - Controls: Rewind 10s, Play/Pause, Forward 10s, seek slider, speed selector.
  - Uses `sharedIsPlaying`, `sharedCurrentTime`, `sharedDuration`, `sharedPlaybackRate` from `useAudio()` and `player.play/pause/seek` from `useAudioPlayer`.
- Audio Library
  - `client/src/pages/AudioLibrary.jsx:306` renders `PlayerPanel` on the right side.
  - `client/src/components/audioLibrary/PlayerPanel.jsx` is the original right-side panel with cover, favorite, prev/play/next, progress, language, voice, speed, Download, Open in Studio.
  - Uses `useAudio()` for shared state.

### Existing dependencies
- `AudioContext.jsx` provides shared `audioRef` and state: `isPlaying`, `currentTime`, `duration`, `playbackRate`, `activeChapter`, `play`, `pause`, `seek`, `setPlaybackRate`.
- `useAudioPlayer` provides per-player alignment tracking and playback verification, delegates playback to context.

### No direct dependency on GlobalPlayer
- Studio `BottomPlayer` and Audio Library `PlayerPanel` do not import or reference `GlobalPlayer`.
- Removing `GlobalPlayer` does not break playback logic; both original players continue to drive `AudioContext`.

## Proposed Changes

### 1. Remove GlobalPlayer from AppLayout
File: `client/src/components/layout/AppLayout.jsx`
- Remove import `import { GlobalPlayer } from './GlobalPlayer.jsx';`
- Remove `<GlobalPlayer />` from render tree at line 25.
- Keep `AppLayout` structure unchanged.

### 2. Optional cleanup
- `GlobalPlayer.jsx` can be left in repo but unused, or removed entirely. Minimal change is to just stop rendering it. Removing the file is safe if no imports remain. Verify after removal.

No changes to:
- `AudioContext.jsx`
- `useAudioPlayer.jsx`
- `BottomPlayer.jsx`
- `PlayerPanel.jsx`
- `StudioLayout.jsx`
- `Dashboard.jsx`
- `AudioLibrary.jsx`

## What will be removed
- Global sticky bottom player UI on Home, My Books, Recent, Settings, Audio Library, Studio.
- Unconditional mounting of `GlobalPlayer` in `AppLayout`.

## What will be preserved
- Studio original `BottomPlayer` below transcript, with rewind 10s, play/pause, forward 10s, seek, speed.
- Audio Library right-side `PlayerPanel` with cover, controls, language/voice/speed, Download, Open in Studio.
- `AudioContext` single shared audio element and playback state.
- Playback history logging, favorites, By Book, Downloads, Continue Listening.
- Sidebar navigation, page layouts, styling.

## How playback works after removal
- Studio
  - Play/Pause via `BottomPlayer` → calls `player.play()` / `player.pause()` which delegate to `AudioContext.play(activeChapter)` / `pause()`.
  - Progress updates from `AudioContext` state, synced to UI.
  - Speed changes via `BottomPlayer` speed selector → `setPlaybackRate`.
- Audio Library
  - Play/Pause/Prev/Next via `PlayerPanel` → uses `useAudio()` directly.
  - Progress, duration, speed reflect shared context.
- Other pages
  - No player UI shown. `AudioContext` remains active for background playback if started elsewhere.

## Risks & Mitigations
- If any other component programmatically relies on GlobalPlayer being present for UI state, removal may expose empty space. AppLayout layout uses flex column; removing GlobalPlayer only reduces height, no layout break.
- No duplicate audio instances introduced.
- Ensure `AppLayout` still wraps content correctly after removal.

## Validation Plan
1. Studio page loads with only original Studio `BottomPlayer` below transcript; no second player at bottom.
2. Generate Audio works; Play/Pause works in Studio player; rewind/forward 10s works; progress updates; speed works.
3. Audio Library loads; right-side `PlayerPanel` visible and functional; no global bottom player.
4. Home/My Books/Recent/Settings show no global bottom player.
5. `npm run build` succeeds.
6. `npx tsc --noEmit` succeeds.
7. Manual browser playback test confirms single source of truth via `AudioContext`.

## Open Questions
- Confirm user wants `GlobalPlayer.jsx` file deleted or just unmounted. Recommendation: keep file for now, only unmount; delete in follow-up if desired.
- Confirm no other layouts bypass `AppLayout`. Audit shows all main pages use `AppLayout`.

Await explicit approval before editing files.
