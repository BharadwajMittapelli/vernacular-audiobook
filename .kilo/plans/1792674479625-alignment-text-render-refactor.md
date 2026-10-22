# Refactor: TranscriptHighlighter Renders Alignment Text Only

## Problem
- `ttsProvider.js` now translates English → Indic script **before** alignment calculation
- `alignment[]` entries contain translated text (e.g. Telugu `తెలుగు`) + timestamps
- `TranscriptHighlighter.jsx` has a **JSX syntax error**: an orphaned `</option>` and `<select>` fragment inside each `<p>` element (lines 77-78) — this crashes the component at render time
- The component should derive display text exclusively from `alignment` entries, not from any separate raw English text state

## Decision: alignment array is the single source of truth

The alignment array already carries both the correct Indic-script text and accurate timestamps. No separate English text prop is needed for the synced playback view.

## Changes

### 1. `client/src/components/player/TranscriptHighlighter.jsx` — refactor

**Remove:**
- The orphaned `<select>/<option>` JSX fragment (current lines 76-78)
- The unused `currentTime` prop (only `currentSentenceIndex` is used for highlighting)

**Keep / verify:**
- Map over `alignment` array → render `entry.text` (translated Indic text from API)
- Highlight via `index === currentSentenceIndex`
- Click-to-seek via `entry.startTime`
- Null guard on empty alignment

**No longer needed:** any reference to raw English/chapter text for the synced view.

```jsx
import React from 'react';

export function TranscriptHighlighter({ alignment, currentSentenceIndex = -1, onSeek }) {
  if (!alignment || alignment.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <p>No transcript available.</p>
        <p className="mt-1 text-xs">Generate audio to see synchronized text.</p>
      </div>
    );
  }

  return (
    <div
      className="max-w-prose mx-auto space-y-1 font-serif text-base leading-relaxed"
      role="log"
      aria-label="Transcript"
      aria-live="polite"
    >
      {alignment.map((entry, index) => {
        const isActive = index === currentSentenceIndex;
        return (
          <p
            key={entry.sentenceIndex ?? index}
            onClick={() => onSeek?.(entry.startTime)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSeek?.(entry.startTime);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Play: ${entry.text}`}
            aria-current={isActive ? 'true' : undefined}
            className={`
              px-3 py-1.5 rounded-md cursor-pointer transition-colors
              ${isActive
                ? 'bg-terracotta/10 text-foreground font-medium'
                : 'text-foreground hover:bg-muted'
              }
            `}
          >
            {entry.text}
          </p>
        );
      })}
    </div>
  );
}
```

### 2. `client/src/components/player/ReadAlongPlayer.jsx` — drop `chapterText` from the aligned path

**Change:** when `audioUrl && alignment.length > 0`, pass only the props `TranscriptHighlighter` now needs. `chapterText` remains as a fallback for the plain-text display path (no audio yet).

```jsx
import React from 'react';
import { TranscriptHighlighter } from './TranscriptHighlighter.jsx';

export function ReadAlongPlayer({
  audioUrl,
  alignment,
  chapterText,
  currentTime = 0,
  currentSentenceIndex = -1,
  onSeek,
}) {
  // Priority 1: Audio + alignment — show translated synced transcript
  if (audioUrl && alignment?.length > 0) {
    return (
      <TranscriptHighlighter
        alignment={alignment}
        currentSentenceIndex={currentSentenceIndex}
        onSeek={onSeek}
      />
    );
  }

  // Priority 2: Audio exists but no alignment — show message
  if (audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-center text-sm">No synchronization data available</p>
        <p className="text-center text-xs mt-1 text-muted-foreground/60">
          Audio is ready but alignment data is missing
        </p>
      </div>
    );
  }

  // Priority 3: No audio — show raw chapter text (pre-generation state)
  const hasText = chapterText && chapterText.trim().length > 0;
  if (hasText) {
    return (
      <div className="max-w-prose mx-auto font-serif text-base leading-relaxed whitespace-pre-wrap text-foreground px-4">
        {chapterText}
      </div>
    );
  }

  // Priority 4: Nothing available
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-center text-sm">No content available</p>
      <p className="text-center text-xs mt-1 text-muted-foreground/60">
        Load a book or generate audio to view the transcript
      </p>
    </div>
  );
}
```

### 3. Call sites — no breaking changes needed

- **`Dashboard.jsx`** (lines 355-362, 368-375): already passes `currentTime` and `currentSentenceIndex`; these extra props are harmlessly ignored by the updated `TranscriptHighlighter`. No edit required.
- **`AudioStorefrontWidget.jsx`** (line 36-40): does not pass `currentSentenceIndex`; the component defaults to `-1` (no highlight), which is correct for the storefront embed. No edit required.

## Validation

1. Generate audio for a chapter with an Indic language (e.g. `te-IN`)
2. Open Dashboard → Read-Along tab
3. Confirm the transcript displays **Telugu script** text (not English)
4. Play audio → active sentence highlights correctly in sync
5. Click any sentence → audio seeks to `entry.startTime`
6. Verify no console errors (the old JSX syntax error must be gone)
7. Test `en-IN` path: alignment should still work (no translation, English text in alignment)
8. Test fallback path (no audio generated yet): `chapterText` plain display still works

## Risk

- None. The change removes a syntax error and narrows the data source to what the API already provides. `chapterText` fallback for pre-generation state is preserved in `ReadAlongPlayer`.
