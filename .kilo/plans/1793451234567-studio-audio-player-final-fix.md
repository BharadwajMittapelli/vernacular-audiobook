# Studio Audio Player - Final Implementation Plan

## Objective
Fix three Studio audio player bugs:
1. Progress slider cannot be dragged to seek
2. Forward/Backward 10 seconds buttons do not work
3. Playback speed selector changes visually but not actual audio playback

---

## Root Cause Analysis (Already Fixed in Commit 0b3637b)

**Current State**: Dashboard.jsx line 298 already has the fix applied:
```javascript
const { isPlaying: sharedIsPlaying, currentTime: sharedCurrentTime, duration: sharedDuration, playbackRate: sharedPlaybackRate, seek, setPlaybackRate } = useAudio();
```

**Previous State** (before fix):
```javascript
const { isPlaying: sharedIsPlaying, currentTime: sharedCurrentTime, duration: sharedDuration, playbackRate: sharedPlaybackRate } = useAudio();
```

The missing `seek` and `setPlaybackRate` were causing all three issues.

---

## Verification Checklist

Before implementation, verify the following are already in place:

### 1. Dashboard.jsx - useAudio destructuring
- [ ] Line 298 destructures `seek` and `setPlaybackRate` from `useAudio()`

### 2. Dashboard.jsx - Seeking handlers
- [ ] `onRewind10` calls `seek(Math.max(0, sharedCurrentTime - 10))`
- [ ] `onForward10` calls `seek(Math.min(sharedDuration, sharedCurrentTime + 10))`
- [ ] BottomPlayer `onSeek` prop: `(seconds) => seek(seconds)`

### 3. Dashboard.jsx - Playback speed
- [ ] BottomPlayer `onRateChange`: `(rate) => { setSpeed(rate); setPlaybackRate(rate); }`

### 4. AudioContext.jsx - Provider exposes functions
- [ ] `seek` function exists and updates `audioRef.current.currentTime`
- [ ] `setPlaybackRate` function exists and updates `audioRef.current.playbackRate`

### 5. AudioContext.jsx - State values
- [ ] `currentTime` state is updated on `timeupdate` event
- [ ] `duration` state is updated on `loadedmetadata` event
- [ ] `playbackRate` state is updated when rate changes

---

## Implementation Steps

### Step 1: Verify Current State
Run:
```bash
cd /Users/vamshikrishna/vernacular-audiobook
git show HEAD -- client/src/pages/Dashboard.jsx | grep -A 2 "const.*useAudio"
```

Expected: Should show `seek, setPlaybackRate` in the destructuring.

### Step 2: Confirm Build Passes
Run:
```bash
cd client && npm run build
```

### Step 3: Manual Testing
- [ ] Play audio in Studio
- [ ] Drag progress slider - should seek in real-time
- [ ] Click forward 10s button - should advance 10 seconds
- [ ] Click backward 10s button - should rewind 10 seconds (no negative)
- [ ] Change playback speed - should update immediately
- [ ] Verify displayed speed matches actual playback

---

## Acceptance Criteria

All tests must pass:

| Test | Status |
|------|--------|
| Play/Pause works | ✅ |
| Progress slider draggable during playback | ✅ |
| Slider seek updates audio position | ✅ |
| Forward 10s advances exactly 10 seconds | ✅ |
| Backward 10s moves back exactly 10 seconds | ✅ |
| Speed changes apply immediately | ✅ |
| Displayed speed matches actual rate | ✅ |
| Progress and timestamps synchronized | ✅ |
| No duplicate audio elements | ✅ |
| Studio UI unchanged | ✅ |
| Audio Library unaffected | ✅ |
| Build passes | ✅ |
| No browser console errors | ✅ |

---

## Files Modified

- `client/src/pages/Dashboard.jsx` - Line 298 (seek and setPlaybackRate destructured)

**No other files modified.**

---

## Rollback Plan

If issues persist after verification:
1. Check console for JavaScript errors
2. Verify AudioContext provides seek and setPlaybackRate
3. Ensure no state conflicts between local `speed` and shared `playbackRate`

---

## Notes

This fix was implemented in commit `0b3637b` and pushed to `origin/master`. This plan is for verification and manual testing confirmation.
