# Plan: Phase 3 — Improve Bottom Audio Player UI

## Context
Project: Ekithab AI / Vernacular Audiobook
Working directory: /Users/vamshikrishna/vernacular-audiobook

Inspected `client/src/components/layout/BottomPlayer.jsx`:
- Player height `h-20`, border top, bg-card, flex column.
- Progress bar rendered at top `h-4` with seekable bar, elapsed/total not inline.
- Controls row contains: chapter initials box + truncated chapter title, SkipBack / PlayPause / SkipForward buttons, elapsed time span, total duration span, flex spacer, Speed label + `<select>` dropdown.
- Props received from Dashboard:
  `audioUrl, isPlaying, currentTime, duration, playbackRate, currentChapterTitle, onPlay, onPause, onRewind, onForward, onSeek, onRateChange`
- No book title, no book cover, no playlist/fullscreen controls.
- Dashboard `onRewind`/`onForward` implement sentence skip with 15s fallback.

Task 1 & 2 changes preserved: VoiceSelector single column, TopBar avatar terracotta.

## Objective
Refine BottomPlayer UI to match intended design while preserving all audio functionality, book info display, responsiveness, and existing Phase 1-2 work.

## Files to modify
- `client/src/components/layout/BottomPlayer.jsx`
- Minimum required prop wiring in `client/src/pages/Dashboard.jsx` to pass `bookTitle` and optional `bookCoverUrl` to BottomPlayer.
- No other files modified.

## Proposed changes

### Book information
- Inspect existing book data model: current code shows `book.title` and `book.chapters`, no `coverUrl` field found. Use `book?.coverUrl` only if present; do not introduce mock data or hardcoded URLs.
- Add optional props `bookTitle` and `bookCoverUrl` to BottomPlayer.
- Dashboard passes `bookTitle={book?.title}` and `bookCoverUrl={book?.coverUrl}` if available.
- UI block for book info:
  - Leftmost area shows cover: if `bookCoverUrl` is truthy, render `<img src={bookCoverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />`. Fallback to existing initials box using `bookTitle?.slice(0,2).toUpperCase()` or chapter initials.
  - Text stack on separate lines: chapter title line 1, book title line 2 muted.
  - Preserve fallback when book/chapter missing: hide block or show placeholder.
  - Keep width constrained, `shrink-0`, truncate long titles.

### Playback controls
- Preserve existing `onPlay/onPause/onRewind/onForward` handlers without changing sentence-skipping behavior or 15-second fallback.
- Do not label controls as fixed 10-second skips; use accurate accessible labels reflecting actual behavior, e.g., `aria-label="Previous"` / `aria-label="Next"`.
- Update UI:
  - Make main play/pause button prominent dark circular control: use existing Button with `rounded-full` and increased size, reuse existing icons.
  - Keep SkipBack/SkipForward icons and reuse existing handlers.

### Progress bar
- Preserve existing seeking calculations and `handleProgressClick` handler.
- Guard against zero or invalid duration: keep `duration > 0` checks for width and left position.
- Maintain sufficiently large touch target for the bar, e.g., `h-4` hit area.
- Preserve keyboard accessibility: bar remains focusable via surrounding controls.
- Horizontal layout: elapsed time, seekable progress bar, total duration on same line.
- Move timestamps inline with bar: left `formatTime(currentTime)`, center bar, right `formatTime(duration)`.
- Preserve `transition-[width]` and seek synchronization.

### Playback speed
- Keep speed selector compact and rounded.
- Preserve `<select>` options `[0.5,0.75,1,1.25,1.5,2]`.
- Style for compact rounded appearance: keep `rounded px-2 py-1` and `focus:ring-terracotta/40`.

### Additional controls
- No playlist/fullscreen controls implemented; do not add placeholders.
- Preserve existing controls only.

### Responsiveness
- Do not rely on `overflow-hidden` to conceal controls.
- Use responsive flex layouts or wrapping:
  - Controls row uses `flex flex-wrap items-center gap-3 min-w-0`.
  - Book info block has max-width and truncates, `shrink-0`.
  - On small widths, allow player height to grow; stack elements with wrapping rather than clipping.
  - Ensure play/pause, skip, progress, and speed controls remain usable at 320px width.
- Progress bar remains seekable on mobile with sufficient touch target.

## Decisions
- Inspect book data model for cover URL; use if available, otherwise preserve initials fallback.
- Add `bookTitle` prop; cover URL optional, fallback to initials. No mock data or hardcoded URLs.
- Preserve existing `onRewind/onForward` handlers and 15-second fallback; do not label controls as fixed 10-second skips.
- Preserve existing seeking calculations and handlers; guard invalid duration.
- Use responsive flex layouts/wrapping instead of `overflow-hidden` to handle small screens.
- Allow player height to grow on mobile to keep controls usable.
- Keep main play/pause prominent by styling existing Button, no new dependencies.
- No new player features added.

## Risks / Edge cases
- Book cover URL may not exist in data model; fallback to initials must work.
- Long chapter/book titles may wrap; enforce truncation and separate lines.
- Changing progress bar layout may affect seeking hit area; test click handling.
- Removing flex spacer may affect right alignment; verify responsive breakpoints.
- OnRewind/onForward currently 15s fallback vs required 10s; decide to keep existing behavior to avoid logic change or adjust to 10s.

## Validation plan
- Inspect and confirm book data model coverage: report presence/absence of cover URL field.
- Book cover shows when URL present; fallback initials shown otherwise.
- Chapter title and book title display on separate lines.
- Play/pause works, rewind/forward triggers handlers; preserve 15s fallback and sentence skip.
- Progress bar seekable, elapsed and total duration visible inline, updates during playback; invalid duration guarded.
- Speed selector compact rounded, rate changes reflected.
- Responsive layout: controls usable at 320px width without clipping or overflow-hiding behavior.
- Missing book/audio fallbacks render gracefully.
- Run `npm run build` from `client` directory and report actual result.
- Report exactly what was tested (desktop, mobile widths, actual playback/seeking if possible) and what could not be verified due to lack of server/data.
- Task 1 & 2 changes remain intact.

## Out of scope
- Audio API, playback logic, backend, Supabase, database, environment changes.
- Adding playlist/fullscreen features.
- Changing global tokens.

## Open questions
- Book data model coverage: no `coverUrl` field found in current client inspection. If backend provides cover metadata, pass it through; otherwise fallback initials will be used.
- Skip behavior remains unchanged; UI labels will accurately describe existing sentence skip / 15s fallback rather than fixed 10s.
