# Implementation Plan: Match Audio Player Controls to Reference Screenshot

## Context

The bottom audio player (`client/src/components/layout/BottomPlayer.jsx`) currently renders rewind/forward controls using custom SVG icons that don't match the reference screenshot. The reference shows clean circular-arrow icons with the number "10" centered inside each arrow, no filled backgrounds, and dark charcoal strokes.

## Current State

- `Rewind10` component (lines 6–22): Uses a near-complete circular arc (`M3 10a9 9 0 1 1-.5 4`) with an L-shaped polyline arrowhead. The "10" text is at x=15, y=15 (offset to the right-bottom, not centered).
- `Forward10` component (lines 24–40): Mirror of the above — arc from right side, arrowhead at left, "10" text at x=9, y=15 (offset to the left-bottom).
- Both icons are rendered inside `<Button variant="ghost">` buttons that add `rounded-full h-8 w-8` styling.
- Play/Pause button uses lucide `Play`/`Pause` icons inside a `rounded-full h-9 w-9 bg-foreground` button.

## Target State

Match the reference screenshot exactly:
- **Rewind 10s**: Clockwise circular arc (270°, from left → top → right → bottom), arrowhead at bottom pointing down, "10" centered in the upper portion. Dark charcoal stroke, no fill, no button background.
- **Forward 10s**: Counterclockwise circular arc (270°, from right → top → left → bottom), arrowhead at bottom pointing up-right, "10" centered in the upper portion. Dark charcoal stroke, no fill, no button background.
- **Play/Pause**: Solid dark charcoal circular button (already correct, keep as-is).
- **Layout**: `[Rewind 10] [Play/Pause] [Forward 10]` horizontally aligned.

## Changes

### File: `client/src/components/layout/BottomPlayer.jsx`

**1. Replace `Rewind10` component (lines 6–22)**

Replace the existing SVG with a properly drawn circular arrow:
- Arc: clockwise 270° from 180° (left) to 270° (bottom), radius 7, center (12,12)
- Arrowhead: 3-point polygon at the bottom endpoint, pointing downward
- Text: "10" centered at approximately (12, 11) with appropriate font-size
- Stroke: `currentColor`, `strokeWidth="2"`, `fill="none"`, `strokeLinecap="round"`

**2. Replace `Forward10` component (lines 24–40)**

Mirror of Rewind10 but with:
- Arc: counterclockwise 270° from 0° (right) to 270° (bottom), radius 7, center (12,12)
- Arrowhead: 3-point polygon at the bottom endpoint, pointing upward-right (tangent direction)
- Text: "10" centered at approximately (12, 11)
- Same stroke attributes

**3. Adjust button styling for skip controls (lines 109–138)**

Change the `Rewind10` and `Forward10` buttons to remove the filled background and border:
- Remove `variant="ghost"` (which adds background on hover)
- Keep `size="icon"` and `className="rounded-full h-8 w-8 cursor-pointer"` 
- Add `className="p-0 hover:bg-transparent"` to prevent any background on hover
- The icon SVG uses `currentColor` so it inherits the button text color (foreground)

Actually, since `variant="ghost"` already has no background, the existing button styling is fine. The main visual change is in the SVG paths themselves.

## SVG Path Details

### Rewind10 (new)
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
  <path d="M3 3v5h5" />
  <text x="12" y="14" text-anchor="middle" dominant-baseline="middle" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">10</text>
</svg>
```

### Forward10 (new)
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
  <path d="M21 3v5h-5" />
  <text x="12" y="14" text-anchor="middle" dominant-baseline="middle" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">10</text>
</svg>
```

## What Stays Unchanged

- Play/Pause button (lucide icons, dark circular background) — already matches reference
- Button sizes: rewind/forward at `h-8 w-8`, play at `h-9 w-9`
- Layout: flex row with `gap-1.5`, vertically centered
- Seek behavior: `onRewind10` seeks -10s (clamped at 0), `onForward10` seeks +10s (clamped at duration)
- Disabled state: both skip buttons disabled when `!hasAudio`
- All component props, exports, and the Dashboard handler signatures

## Verification

| Check | Expected |
|-------|----------|
| Build passes | `npm run build:client` succeeds |
| TypeScript check | `npx tsc --noEmit` passes |
| Rewind icon visual | Circular arrow pointing backward, "10" centered inside |
| Forward icon visual | Circular arrow pointing forward, "10" centered inside |
| Play/Pause unchanged | Solid dark circle with white icon |
| Rewind seek | Seeks back 10s, clamped at 0 |
| Forward seek | Seeks forward 10s, clamped at duration |
| Disabled state | Skip buttons grayed out when no audio |
| Alignment | Three controls vertically aligned in a row |

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `client/src/components/layout/BottomPlayer.jsx` | 6–40 | Replace `Rewind10` and `Forward10` SVG paths |

**Total: 1 file, ~35 lines modified (icon reimplementation only).**
