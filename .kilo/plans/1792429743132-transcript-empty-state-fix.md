# Plan: Phase 4 — Fix Transcript Empty-State Behavior

## Root Cause
`ReadAlongPlayer.jsx` line 12-20: when `!audioUrl`, returns empty state immediately — never checks if `chapterText` exists. Chapter text is ignored despite being available.

## Files to Modify
- **Only**: `client/src/components/player/ReadAlongPlayer.jsx`
- **No Dashboard changes needed**: `chapterText={chapter.text}` already wired in both transcript (line 359) and read-along (line 375) tabs.

## Implementation

### ReadAlongPlayer.jsx — New conditional logic

```
Priority order:
1. audioUrl exists + alignment has entries → synchronized transcript (unchanged)
2. audioUrl exists + alignment empty → sync-unavailable message
3. chapterText exists (even without audio) → plain text transcript
4. neither → empty state
```

**Code structure:**
```jsx
if (audioUrl && alignment?.length > 0) {
  // Return existing TranscriptHighlighter (preserves all playback/sync)
}

if (audioUrl && (!alignment || alignment.length === 0)) {
  // Audio exists but no alignment data
  return <div>No synchronization data available</div>
}

if (chapterText && chapterText.trim().length > 0) {
  // Text exists — show plain formatted text
  return <div className="max-w-prose mx-auto font-serif text-base leading-relaxed whitespace-pre-wrap">{chapterText}</div>
}

// Fallback empty state
return <div>No content available</div>
```

## Design Decisions

### Why only ReadAlongPlayer?
- Dashboard already passes correct props
- Component encapsulates rendering logic
- Minimal change boundary

### Whitespace-only text treatment
- `chapterText.trim().length > 0` check prevents showing empty whitespace as content
- Matches requirement to treat whitespace-only as missing

### Formatting preservation
- `whitespace-pre-wrap` preserves original line breaks and indentation
- No trimming, splitting, or transformation of chapter content
- `font-serif text-base leading-relaxed` matches existing transcript styling

### Avoiding nested scrollbars
- Container has `max-w-prose mx-auto` but no height constraint
- Parent `studioContent` has `overflow-y-auto` which handles scrolling
- Plain text display doesn't add extra scroll containers

## Validation Matrix

| Scenario | Expected Result |
|----------|-----------------|
| Text exists, no audio | Shows formatted chapter text |
| Text exists, audio exists, alignment exists | Shows synchronized transcript with highlighting |
| Text exists, audio exists, alignment missing | Shows "No synchronization data available" |
| No text (or whitespace-only), no audio | Shows empty state |
| Switch chapters | Transcript updates to new chapter's text |
| Audio playback/seeking | Unchanged when alignment present |

## Risks / Edge Cases

1. **Long chapters**: May create tall content — parent container scrolls via existing `overflow-y-auto scrollbar-thin` in Dashboard (line 345)
2. **Special characters in text**: `whitespace-pre-wrap` preserves all characters including markdown syntax
3. **Chapter switching**: `chapter` state updates via `selectChapter()` (line 182) which sets `activeIdx` and triggers re-render

## Out of Scope

- Backend API changes
- Audio generation logic
- TranscriptHighlighter modifications (preserved as-is for synchronized mode)
- Task 1-3 changes (VoiceSelector, TopBar, BottomPlayer)

## Build Command
```bash
cd /Users/vamshikrishna/vernacular-audiobook/client && npm run build
```
