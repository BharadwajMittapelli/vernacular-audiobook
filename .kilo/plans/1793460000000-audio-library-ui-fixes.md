# Audio Library — Play/Pause Functionality Fix

## Problem
In All Audio and By Book views, clicking a row's play button only starts playback; it does not pause if the same chapter is already playing. It also doesn't resume if paused. This forces users to use the right-side panel for pausing/resuming.

## Root Cause
The `onPlay` handler passed to the row components (e.g., `playChapter` in `AudioLibrary.jsx`) only ever calls `play(chapterData)`. It doesn't check if the requested chapter is already active.

## Proposed Solution
Modify `playChapter` in `AudioLibrary.jsx` to toggle between play and pause if the same chapter is clicked.

```jsx
const playChapter = useCallback(async (chapterId) => {
  // If clicking currently active chapter, toggle pause/play
  if (globalActiveChapter?.chapterId === chapterId) {
    if (isPlaying) {
      pause();
    } else {
      play(globalActiveChapter);
    }
    return;
  }

  // Otherwise, load and play the new chapter (existing logic)
  const chapter = items.find((i) => i.chapterId === chapterId);
  // ... rest of loading logic
}, [globalActiveChapter, isPlaying, play, pause, items]);
```

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/AudioLibrary.jsx` | Update `playChapter` to handle toggle logic |
| `client/src/components/audioLibrary/ByBookView.jsx` | Match logic for "Play first chapter" button and individual ChapterRows |

## Detailed Implementation Plan

### 1. `AudioLibrary.jsx` — `playChapter` refinement
- Check `globalActiveChapter.chapterId === chapterId`
- If true: toggle `isPlaying ? pause() : play(globalActiveChapter)`
- If false: proceed with existing logic to fetch URL and play new chapter

### 2. `ByBookView.jsx` — Consistency
The "Play first chapter" button in `BookCard` and individual `ChapterRow` buttons both use the `onPlay` callback. By fixing `playChapter` in the parent, these will automatically gain the toggle behavior.

**Wait:** `ByBookView.jsx` also needs to ensure it passes the correct `isActive` and `isPlaying` state to its buttons so the icon changes to Pause.

### 3. Icon State Synchronization
- `AudioRow.jsx` (already handles this correctly: line 36–39)
- `ByBookView.jsx` (already handles this correctly: line 143–153)
- `FavoritesView.jsx` (already handles this correctly: line 76–86)

These components already use `isActive && isPlaying` to decide between Pause and Play icons. They just need the click handler to actually perform the pause.

## What Is NOT Changed
- No changes to `AudioContext.jsx` (it already provides correct primitives)
- No changes to `PlayerPanel.jsx` (it's already synchronized)
- No changes to UI layout or styling
- No new dependencies

## Validation Steps
1. All Audio tab: Click Play on a row → audio starts, icon becomes Pause.
2. Click same row's button → audio pauses, icon becomes Play.
3. Click same row's button → audio resumes, icon becomes Pause.
4. Click different row's button → new chapter starts, previous button resets to Play.
5. Repeat same checks in By Book tab.
6. Verify right-side panel play/pause button stays in sync with table buttons.
7. `npm run build` passes.
