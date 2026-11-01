# Studio Audio Player Minor Bug Fixes - Implementation Plan

## Problem Analysis

### Current State
The Studio page uses shared AudioContext for playback state but has broken controls:
- Progress slider cannot be moved
- Forward/backward 10s buttons don't work  
- Playback speed changes don't apply

### Root Causes Identified

1. **Manual seeking not working**: BottomPlayer's `onSeek` prop calls `seek(seconds)` where `seek` is undefined. The Dashboard destructures `isPlaying`, `currentTime`, `duration`, and `playbackRate` from `useAudio()`, but not the `seek` and `setPlaybackRate` functions.

2. **Forward/backward 10s failing**: `onRewind10` and `onForward10` handlers call `seek(...)` where `seek` is undefined.

3. **Playback speed not updating**: BottomPlayer's `onRateChange` calls `setPlaybackRate(rate)` where `setPlaybackRate` is undefined. Dashboard only destructures `playbackRate` state, not the setter function.

### Code Evidence

Dashboard.jsx line 298:
```js
const { isPlaying: sharedIsPlaying, currentTime: sharedCurrentTime, duration: sharedDuration, playbackRate: sharedPlaybackRate } = useAudio();
```
Missing `seek` and `setPlaybackRate` destructuring.

Dashboard.jsx line 536:
```js
seek(Math.max(0, sharedCurrentTime - 10));
```
`seek` is undefined.

Dashboard.jsx line 901:
```js
onSeek={(seconds) => seek(seconds)}
```
`seek` is undefined.

Dashboard.jsx line 902:
```js
onRateChange={(rate) => { setSpeed(rate); setPlaybackRate(rate); }}
```
`setPlaybackRate` is undefined.

## Files Requiring Changes

**Primary file:**
- `client/src/pages/Dashboard.jsx`

**Files inspected (no changes needed):**
- `client/src/components/layout/BottomPlayer.jsx` - correctly receives props
- `client/src/hooks/useAudioPlayer.jsx` - correctly delegates to AudioContext
- `client/src/context/AudioContext.jsx` - provides seek and setPlaybackRate

## Minimal Implementation Plan

### Step 1: Fix useAudio destructuring
Update Dashboard.jsx line 298 to destructure seek and setPlaybackRate:
```js
const { isPlaying: sharedIsPlaying, currentTime: sharedCurrentTime, duration: sharedDuration, playbackRate: sharedPlaybackRate, seek, setPlaybackRate } = useAudio();
```

### Step 2: Verify onRewind10 and onForward10 handlers
These handlers already use shared state correctly, will work once seek is defined:
- Line 535-537: `onRewind10` uses `sharedDuration` and `sharedCurrentTime` with `seek`
- Line 538-541: `onForward10` uses `sharedDuration` and `sharedCurrentTime` with `seek`

### Step 3: Verify BottomPlayer props
BottomPlayer receives `onSeek` and `onRateChange` callbacks that now reference defined functions:
- Line 901: `onSeek={(seconds) => seek(seconds)}` - works with destructured seek
- Line 902: `onRateChange={(rate) => { setSpeed(rate); setPlaybackRate(rate); }}` - works with destructured setPlaybackRate

### Step 4: Validation
- Build passes
- Manual slider drag seeks audio
- Forward/backward 10s buttons advance/reverse playback
- Speed selector updates playback rate immediately
- State remains synchronized between AudioContext and UI
- No UI changes, no new audio elements, no backend changes

## Risks and Constraints

- Do not modify BottomPlayer UI or layout
- Do not create new audio elements
- Do not change Audio Library functionality
- Preserve existing speed options [0.5, 0.75, 1, 1.25, 1.5, 2]
- Keep shared AudioContext as single source of truth

## Testing Checklist

- [ ] Play/Pause works
- [ ] Progress slider draggable during playback
- [ ] Slider seek updates audio position
- [ ] Forward 10s advances exactly 10 seconds
- [ ] Backward 10s moves back exactly 10 seconds (no negative)
- [ ] Speed changes apply immediately
- [ ] Displayed speed matches actual rate
- [ ] Progress and timestamps synchronized
- [ ] No duplicate audio elements
- [ ] Studio UI unchanged
- [ ] Audio Library unaffected
- [ ] Build passes
