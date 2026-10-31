# Audio Player Controls — Implementation Plan

**File to modify:** `client/src/components/layout/BottomPlayer.jsx`

## Task
Replace rewind/forward SVG icons with custom inline SVGs matching the reference screenshot.

---

## Implementation

### 1. Replace `Rewind10` component (lines 6–22)

```jsx
function Rewind10({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M 17 14 A 7 7 0 1 0 7 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="7 10 4 12 7 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="13"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="6.5"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </svg>
  );
}
```

### 2. Replace `Forward10` component (lines 24–40)

```jsx
function Forward10({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M 7 14 A 7 7 0 1 1 17 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="17 10 20 12 17 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="13"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="6.5"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </svg>
  );
}
```

### 3. Update controls layout (lines 107–139)

Replace the existing controls `div` with:

```jsx
{/* Play controls */}
<div className="flex items-center justify-center gap-5">
  {/* Rewind 10 seconds */}
  <Button
    variant="ghost"
    size="icon"
    type="button"
    aria-label="Rewind 10 seconds"
    title="Rewind 10 seconds"
    disabled={!hasAudio}
    onClick={onRewind10}
    className="h-8 w-8 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent"
  >
    <Rewind10 className="h-8 w-8" />
  </Button>

  {/* Main Play/Pause control */}
  <Button
    type="button"
    variant="default"
    size="icon"
    aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
    title={isPlaying ? 'Pause' : 'Play'}
    disabled={!hasAudio}
    onClick={isPlaying ? onPause : onPlay}
    className="h-12 w-12 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
  >
    {isPlaying ? (
      <Pause className="h-6 w-6" fill="currentColor" />
    ) : (
      <Play className="h-6 w-6" fill="currentColor" />
    )}
  </Button>

  {/* Forward 10 seconds */}
  <Button
    variant="ghost"
    size="icon"
    type="button"
    aria-label="Forward 10 seconds"
    title="Forward 10 seconds"
    disabled={!hasAudio}
    onClick={onForward10}
    className="h-8 w-8 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent"
  >
    <Forward10 className="h-8 w-8" />
  </Button>
</div>
```

---

## What Stays Unchanged

- Book info section (lines 80–105)
- Elapsed time display (lines 141–144)
- Seek slider (lines 146–156)
- Total duration display (lines 158–161)
- Speed selector (lines 163–180)
- Component props and exports
- All handler functions and seek behavior

---

## Verification

After implementation:

1. Run build: `npm run build:client`
2. Type-check: `npx tsc --noEmit`
3. Visual check (if browser available):
   - Open a book in Studio
   - Compare rendered controls with reference screenshot
   - Verify arrowheads at correct positions
   - Verify "10" is centered inside each icon
   - Verify skip buttons are transparent
   - Verify play button is larger and dark

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `client/src/components/layout/BottomPlayer.jsx` | 6–40, 107–139 | Replace SVG icons + update layout |

**Total: 1 file, ~50 lines modified.**

---

**To implement:** Switch to an implementation-capable agent or apply the changes manually to `client/src/components/layout/BottomPlayer.jsx`.
