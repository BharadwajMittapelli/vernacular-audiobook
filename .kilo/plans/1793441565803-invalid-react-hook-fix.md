# Invalid React Hook Call – Emergency Bug Fix Plan

## Problem
Application crashes on load with `Invalid hook call. Hooks can only be called inside the body of a function component.`  
Stack trace points to `useAudioPlayer.jsx:43` → `useAudio → AudioContext.jsx:143`.

## Root Cause
`client/src/hooks/useAudioPlayer.jsx` calls the React hook `useAudio()` inside `useEffect` callbacks:
- Line 57: `const audioCtx = useAudio();` inside effect that syncs `audioRef.current` to the shared AudioContext element.
- Line 71: `const audioCtx = useAudio();` inside effect that resets tracking when the shared element changes.

React Rules of Hooks require hooks to be called only at the top level of a React function component or custom hook, never inside effects, callbacks, conditions or loops. Calling `useAudio()` inside `useEffect` breaks the hook call order and triggers the invariant error.

Secondary issues observed in the same change:
- `useAudio` is listed in dependency arrays `[useAudio, playbackRate]` and `[useAudio, audioUrl]` – the hook function reference is stable but its inclusion is meaningless and masks the real deps.
- Top-level destructuring from `useAudio()` does not include `audioRef`. The effect therefore re-calls the hook to obtain `audioRef`.
- `setPlaybackRate` is destructured from `useAudio()` but `AudioContext.Provider` value does not expose a `setPlaybackRate` method, only `play`, `pause`, `seek`, `audioRef` and state.
- Fallback path creates a new `new Audio(audioUrl)` when context is missing, which would create an additional audio element/instance – requirement forbids additional instances.
- `play` callback passes `audioRef.current` to `audioPlay`, but `audioPlay` expects a chapter object – a latent bug introduced in Phase 4.1.

## Scope & Constraints
- Preserve existing `AudioContext` architecture and shared single audio element.
- Do not create additional Audio instances or audio elements.
- Do not redesign Studio or Audio Library.
- Do not remove playback-history functionality.
- Do not introduce duplicate playback state.
- Minimal change only.

## Affected Files
- `client/src/context/AudioContext.jsx` – provider value, state shape.
- `client/src/hooks/useAudioPlayer.jsx` – invalid hook usage, fallback creation, deps.

## Proposed Minimal Correction

### 1. Move hook usage to top level in `useAudioPlayer`
- Destructure `audioRef` from the top-level `useAudio()` call alongside existing values.
  Top-level call remains at line 9-18.
- Remove both inner `useAudio()` calls inside effects.

### 2. Update "sync shared audio element" effect
File: `client/src/hooks/useAudioPlayer.jsx` ~line 56-67
- Use the top-level `audioRefContext` instead of calling `useAudio()` inside effect.
- Set `audioRef.current = audioRefContext.current` when context exists.
- Remove fallback `new Audio(audioUrl)` branch to avoid creating additional audio instances. If context is missing, keep `audioRef.current` unchanged; the component will be non-functional outside Provider, which matches the intended architecture.
- Dependency array: `[audioRefContext?.current, playbackRate]` or keep `[playbackRate]` if ref identity is stable. Do not include `useAudio`.

### 3. Update "reset tracking on shared element change" effect
File: `client/src/hooks/useAudioPlayer.jsx` ~line 70-79
- Use top-level `audioRefContext` to compare `audioRef.current` with `audioRefContext.current`.
- Remove inner `useAudio()` call.
- Dependency array: `[audioRefContext?.current, audioUrl]` – no `useAudio`.

### 4. Clean dependencies
- Remove `useAudio` from all dependency arrays in `useAudioPlayer`.
- Ensure effects only depend on stable values: `audioUrl`, `playbackRate`, `chapterId`, `bookId`, `onPlaybackVerified`, and the ref objects.

### 5. Add `setPlaybackRate` to AudioContext
The current provider does not expose `setPlaybackRate`. `useAudioPlayer` destructures it and calls it. Add a `setPlaybackRate` updater to the provider value:
Recommended minimal: add `setPlaybackRate` to provider value:
```js
const setPlaybackRate = useCallback((rate) => {
  audioRef.current.playbackRate = rate;
  updateState({ playbackRate: rate });
}, []);
```
Expose it in Provider value alongside `play`, `pause`, `seek`, `audioRef`.

### 6. Play callback correction – must fix
`play` currently calls `audioPlay(audioRef.current)`. `AudioContext.play` expects a chapter object with `audioUrl` and optionally `chapterId`. Correct the call to construct a chapter from available props:
```js
const chapter = { audioUrl, chapterId, bookId };
audioPlay(chapter);
```
Remove direct manipulation of `audioRef.current.playbackRate` in `play`; playbackRate is managed by AudioContext state. Keep the call signature consistent with the existing playback contract. This fixes the argument mismatch introduced in Phase 4.1.

## Validation Steps
1. Application loads without Invalid Hook Call error at `localhost:5175`.
2. Studio renders successfully.
3. Audio Library renders successfully.
4. GlobalPlayer renders successfully.
5. Dashboard renders successfully.
6. PublicListener renders successfully.
7. Play/pause works through shared context via `useAudioPlayer`.
8. Playback rate changes propagate to shared audio element and UI.
9. Studio progress updates correctly.
10. No duplicate audio elements are introduced.
11. `npm run build` succeeds.
12. `npx tsc --noEmit` succeeds with no type errors.

## Risks
- Removing fallback `new Audio` may cause silent failure if component is rendered outside `AudioProvider`. Verify all usages of `useAudioPlayer` are within Provider – Dashboard and PublicListener are wrapped by `AudioProvider` in app root.
- Adding `setPlaybackRate` to context changes provider value shape; ensure all consumers handle it gracefully.

## Open Questions
- None pending. Play callback correction is now required per latest constraints.

Plan ready for implementation.
