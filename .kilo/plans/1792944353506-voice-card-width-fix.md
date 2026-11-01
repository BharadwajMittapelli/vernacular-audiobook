# Fix Voice Card Width in Audio Settings

## Problem
Voice selection cards in the Audio Settings panel are narrower than the Language dropdown and Estimated Credits card, not filling the full available panel width.

## Root Cause
Two missing `w-full` classes:
1. **`VoiceSelector.jsx` line 42** — the `<button>` elements lack `w-full`, causing them to shrink-wrap to content instead of filling the container.
2. **`Dashboard.jsx` line 580** — the `<div>` wrapping `<VoiceSelector>` lacks `w-full`, so it also doesn't expand to fill the panel's content area.

## Changes

### File 1: `client/src/components/studio/VoiceSelector.jsx`
- **Line 42**: Add `w-full` to the button className.

**Before:**
```jsx
className="cursor-pointer text-left p-3 rounded-lg border transition-colors flex items-start gap-2.5 overflow-hidden hover:border-terracotta/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 focus-visible:bg-terracotta/5
```

**After:**
```jsx
className="w-full cursor-pointer text-left p-3 rounded-lg border transition-colors flex items-start gap-2.5 overflow-hidden hover:border-terracotta/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 focus-visible:bg-terracotta/5
```

### File 2: `client/src/pages/Dashboard.jsx`
- **Line 580**: Add `w-full` to the div wrapping `<VoiceSelector>`.

**Before:**
```jsx
<div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
```

**After:**
```jsx
<div className="w-full space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
```

## Why This Works
- The Audio Settings panel (`Dashboard.jsx` line 545) has `px-3` horizontal padding. The Language `<select>` already uses `w-full`, which accounts for that padding.
- Adding `w-full` to the voice card container and each card button makes them follow the same pattern as the Language field and Estimated Credits card — both already span the full panel width.
- `min-w-0` is already present on the flex-1 text container inside each card (`VoiceSelector.jsx` line 51), preventing text overflow from pushing the card wider.
- No other layout constraints are affected — the panel width (`min-w-[260px] max-w-[360px] w-[30%]`), padding, and card design are unchanged.

## Verification
1. Open the Dashboard page in a browser.
2. Open the Audio Settings panel (click "Generate Audio" or equivalent).
3. Confirm that each voice card's left and right edges align with the Language dropdown and Estimated Credits card.
4. Confirm no horizontal overflow occurs at any viewport width.
5. Confirm voice selection (click) and preview playback (play button) still work correctly.
6. Test with multiple languages to ensure filtering still works.
