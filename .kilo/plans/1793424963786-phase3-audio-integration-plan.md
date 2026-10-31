# Phase 3: All Audio Data Integration — Implementation Plan (Corrected)

## Executive Summary

Connect the existing All Audio UI (Phase 2) to the playback history API (Phase 1). Core requirement: **only audio actually played in Studio should appear** — not uploaded books, not generated-but-unplayed chapters.

## Current Architecture Findings

### Backend (Phase 1 - COMPLETE)
- `GET /api/library/playback/history` → Returns user's playback history with joins to `books` and `chapters`
- `POST /api/library/playback/log` → Upserts playback record (updates `last_played_at` on replay)
- Table: `playback_history` with unique index on `(user_id, chapter_id)` — enforces one logical entry per user+chapter
- Response structure:
  ```json
  {
    "success": true,
    "history": [{
      "id": "uuid",
      "bookId": "uuid",
      "chapterId": "uuid",
      "firstPlayedAt": "timestamp",
      "lastPlayedAt": "timestamp",
      "bookTitle": "...",
      "bookCoverUrl": "...",
      "chapterTitle": "...",
      "sequenceNumber": 2
    }]
  }
  ```

### Frontend API Service (COMPLETE)
- `getPlaybackHistory()` — line 182-184 in `api.js`
- `logPlayback({ bookId, chapterId })` — line 178-180 in `api.js`
- Both use authenticated axios interceptor with Supabase session

### Phase 2 UI Components (COMPLETE - DO NOT REDESIGN)
| Component | Purpose |
|-----------|---------|
| `AudioLibrary.jsx` | Main page, state management, tab switching |
| `AudioTable.jsx` | Filters, renders `AudioRow` list |
| `AudioRow.jsx` | Single row with play button, metadata columns |
| `PlayerPanel.jsx` | Right sidebar: cover, controls, timeline, metadata, actions |
| `LibraryTopBar.jsx` | Tabs: All Audio, By Book, Favorites, Downloads + book filter |
| `ContinueListening.jsx` | Horizontal scroll of recently played books |
| `DownloadsView.jsx` | Downloads tab (separate data source) |

### Global Audio Player (EXISTS - MUST REUSE)
- `AudioContext.jsx` — React context with single `new Audio()` instance
  - Exposes: `activeChapter`, `isPlaying`, `currentTime`, `duration`, `playbackRate`, `play(chapter)`, `pause()`, `seek(time)`, `setPlaybackRate(rate)`, `audioRef`
- `useAudioPlayer.jsx` — Hook with alignment, playback verification, localStorage persistence (used by Studio/Dashboard)
- `GlobalPlayer.jsx` — Bottom sticky bar (mounted in `AppLayout.jsx:25`), consumes `useAudio()`
- **Critical**: `AudioLibrary.jsx` and `PlayerPanel.jsx` each create their own `audioRef` — **this duplicates the global player and breaks sync**

### Audio URL Retrieval (EXISTS - REUSE)
- `getChapterAudio(chapterId)` → `GET /api/audio/:chapterId` → calls `resolveAudioUrl()` which generates fresh signed URLs
- `resolveAudioUrl(record)` handles `audio_path` (signed URL) with fallback to `audio_url`

---

## Data Gap Analysis

**Playback History API returns:**
- `bookId`, `chapterId`, `bookTitle`, `bookCoverUrl`, `chapterTitle`, `sequenceNumber`, `firstPlayedAt`, `lastPlayedAt`

**UI (AudioRow/PlayerPanel) expects:**
- `language`, `durationSeconds`, `audioUrl`, `voiceName`, `createdAt` (displayed as "Created" column — should map to `lastPlayedAt`)

**Missing data must be fetched from:**
- `audio_generations` (for `language`, `duration`, `audio_path`/`audio_url`) — **must filter by authenticated user and `status = 'completed'`**
- `chapters` table (for `language` fallback)

---

## Corrected Implementation Plan

### Task 1: Backend — Inspect Before Enhancing Playback History Endpoint
**File:** `server/src/routes/libraryRoutes.js` (inspect `GET /playback/history` first)

**Current behavior:** Returns playback history with book/chapter joins only.

**Required enhancement:** Join `audio_generations` to include `language`, `duration`, `audio_path`/`audio_url` for the **latest completed generation belonging to the authenticated user** per chapter.

**Inspection needed first:**
- Verify current query structure
- Confirm `audio_generations` has `chapter_uuid`, `user_id`, `status`, `language`, `duration`, `audio_path`, `audio_url`, `created_at`
- Determine if signed URL resolution happens in backend or frontend

**Proposed approach (pending approval):**
- Add `LEFT JOIN LATERAL` to fetch latest completed `audio_generations` row per chapter for the same `user_id`
- Return enriched fields; let frontend call `getChapterAudio()` for fresh signed URL (recommended) or resolve in backend
- **No schema changes, no new migrations**

**Approval required:** Before any backend modification, present exact SQL and response shape for review.

### Task 2: Frontend — Switch AudioLibrary to Playback History API
**File:** `client/src/pages/AudioLibrary.jsx`

- Replace `getAllLibraryAudio()` with `getPlaybackHistory()` in the `useEffect`
- Map API response to UI item shape:
  - `createdAt` → `lastPlayedAt` (for "Created" column = last played)
  - `language`, `durationSeconds` from enriched response
  - `audioUrl`: if not in response, fetch via `getChapterAudio(chapterId)` on demand (lazy fetch when row selected)
  - `voiceName`: derive from `language` using existing `DEFAULT_VOICE_BY_LANG`
- Add loading, empty, error states per spec
- **Remove local player state**: `audioRef`, `isPlaying`, `progress`, `playbackRate`, `activeChapterId` — delegate to global `AudioContext`

### Task 3: Frontend — Inspect Global Audio Player Contracts
**Files:** `AudioContext.jsx`, `useAudioPlayer.jsx`, `GlobalPlayer.jsx`

**Before integration, verify exact contracts:**

| Source | Exports / Methods |
|--------|-------------------|
| `AudioContext.jsx` | `AudioProvider`, `useAudio()` → `{ activeChapter, isPlaying, currentTime, duration, playbackRate, play, pause, seek, setPlaybackRate, audioRef }` |
| `useAudioPlayer.jsx` | `useAudioPlayer(audioUrl, alignment, options)` → `{ currentTime, duration, isPlaying, playbackRate, currentSentenceIndex, play, pause, seek, setPlaybackRate, seekToSentence }` |
| `GlobalPlayer.jsx` | Consumes `useAudio()`, renders bottom bar |

**Integration rules:**
- One `Audio` element owned by `AudioContext` (line 8: `audioRef = useRef(new Audio())`)
- `AudioContext.play(chapter)` accepts chapter object with `audioUrl`, sets `activeChapter`, starts playback
- `PlayerPanel` must **not** create its own `<audio>` element
- `PlayerPanel` receives playback state via props from `AudioLibrary` (which reads from `useAudio()`)

### Task 4: Frontend — Integrate Global Player in AudioLibrary & PlayerPanel
**Files:** `AudioLibrary.jsx`, `PlayerPanel.jsx`

**AudioLibrary.jsx:**
- Import `useAudio` from `AudioContext.jsx`
- Replace local state with `const { activeChapter, isPlaying, currentTime, duration, playbackRate, play, pause, seek, setPlaybackRate } = useAudio()`
- `playChapter(chapterId)` → **selection only**: fetch audio URL, update `selectedChapterId` state, update PlayerPanel
- **Separate "Play" action**: when play button clicked (in row or PlayerPanel), call `play(chapterData)` with full chapter object

**PlayerPanel.jsx:**
- Remove local `audioRef` and its `useEffect` lifecycle (lines 17-47, 79)
- Remove local `<audio>` element (line 79)
- Read progress from props: `progress = { currentTime, duration }` (passed from AudioLibrary via `useAudio()`)
- `onPlayPause` → `isPlaying ? pause() : play(activeChapter)` (activeChapter passed as prop)
- `onSeek` → `seek(time)`
- `onSkip(seconds)` → `seek(currentTime + seconds)`
- `onPlaybackRateChange` → `setPlaybackRate(nextRate)`

### Task 5: Frontend — Row Selection vs Playback Separation
**Files:** `AudioLibrary.jsx`, `AudioTable.jsx`, `AudioRow.jsx`, `PlayerPanel.jsx`

**Current (incorrect):** `AudioRow.onClick` calls `onPlayPause` which immediately plays.

**Corrected:**
- `AudioRow.onClick` → `onSelect(chapterId)` — updates `selectedChapterId`, loads metadata into PlayerPanel, **does not play**
- `AudioRow` play button (column 1) → `onPlay(chapterId)` — fetches audio URL, calls global `play()`
- `PlayerPanel` play button → `onPlayPause(!isPlaying)` — toggles global player
- `selectedChapterId` state in `AudioLibrary` tracks selection; `activeChapter` from `useAudio()` tracks playback

### Task 6: Frontend — ContinueListening Component
**File:** `client/src/components/audioLibrary/ContinueListening.jsx`

- Accept `history` prop (from `getPlaybackHistory`) — **only played books**
- Sort by `lastPlayedAt` descending, take top 3
- **Progress display**: Only show real progress when the displayed chapter matches `activeChapter` from global player (via prop or context). Otherwise show no progress bar or indeterminate state.
- **No mock/fabricated progress percentages**

### Task 7: Frontend — Loading / Empty / Error States
**Files:** `AudioLibrary.jsx`, `AudioTable.jsx`

- **Loading**: Show spinner/skeleton in table area while `getPlaybackHistory()` pending
- **Empty**: If `history.length === 0` → "No played audio yet. Play chapters in Studio to see them here."
- **Error**: Show message + retry button; do not fall back to mock data or `getAllLibraryAudio()`

### Task 8: Frontend — Preserve Other Tabs & Download Action
- **By Book**: Keep using `getAllLibraryAudio()` — existing data source, **no changes**
- **Favorites**: Leave as "Coming soon..." — no backend yet
- **Downloads**: Uses `getDownloads()` — separate data source, **no changes**
- **Download Audio button** in PlayerPanel: Verify `onDownload` calls `exportBookMp3(bookId)` (not chapterId). If it currently passes `chapterId`, fix to pass `bookId`. Preserve the action entirely.

### Task 9: Frontend — Authentication Isolation
- `getPlaybackHistory()` already uses authenticated axios interceptor (Supabase session)
- `AudioContext` clears state on logout (line 21-31 in `AudioContext.jsx`)
- Verify no cross-user data leakage in any component

---

## Files to Modify (Frontend Only Initially)

| File | Change Type |
|------|-------------|
| `client/src/pages/AudioLibrary.jsx` | Switch API, remove local player state, integrate global player, separate selection/playback |
| `client/src/components/audioLibrary/PlayerPanel.jsx` | Remove local audio element, use global player via props |
| `client/src/components/audioLibrary/ContinueListening.jsx` | Accept history prop, filter to played only, real progress only |
| `client/src/components/audioLibrary/AudioTable.jsx` | Handle empty history case, pass selection callback |
| `client/src/components/audioLibrary/AudioRow.jsx` | Separate `onSelect` (click) from `onPlay` (play button) |

**Backend file:** `server/src/routes/libraryRoutes.js` — **inspection only initially; modification requires approval**

---

## Potential Regressions & Risks

| Risk | Mitigation |
|------|------------|
| Global player already in use elsewhere (Studio, Dashboard) | `AudioContext.play()` handles chapter switching; test that AudioLibrary selection doesn't break existing playback |
| Signed URL expiration during long sessions | `AudioContext` error handler (line 39-48) already re-fetches via `getChapterAudio` on 403/404 |
| `ContinueListening` progress only for active chapter | Show progress bar only when `item.chapterId === activeChapter?.chapterId`; otherwise omit |
| `By Book` tab still shows unplayed audio | Document as known limitation; Phase 4 can align |
| `Download Audio` passes wrong ID | Verify `exportBookMp3(bookId)` — fix if currently passing `chapterId` |
| Favorites/Downloads tabs | Explicitly preserve — no changes |

---

## Testing Strategy

1. **Backend inspection**: Verify enriched `GET /playback/history` response includes `language`, `duration`, `audio_path`/`audio_url` from latest user-owned completed generation
2. **Integration**: 
   - Login → play chapter in Studio → verify appears in All Audio
   - Replay same chapter → verify single row, updated "Created" (lastPlayedAt)
   - Click row (not play button) → PlayerPanel updates, **no auto-play**
   - Click play button (row or panel) → global player starts, GlobalPlayer bottom bar syncs
   - Pause/seek/speed → both PlayerPanel and GlobalPlayer reflect state
   - Logout → playback state clears
3. **Regression**:
   - Studio playback still works
   - Dashboard playback still works
   - GlobalPlayer bottom bar works
   - Downloads tab works
   - My Books page works
   - By Book tab unchanged

---

## Out of Scope (Phase 3)

- By Book tab data source alignment
- Favorites backend/UI
- Download audio from PlayerPanel argument fix (verify only; fix if bug)
- Audio URL prefetching/caching
- Real-time progress in ContinueListening for non-active chapters
- Backend schema changes or new migrations

---

## Acceptance Criteria

1. ✅ Authenticated user sees only their played chapters in All Audio
2. ✅ Unplayed uploaded books do not appear
3. ✅ Generated but unplayed chapters do not appear
4. ✅ Studio-played chapters appear with correct metadata (language, duration, voice)
5. ✅ Replay updates timestamp, no duplicate rows
6. ✅ Row click selects (updates PlayerPanel), play button plays (global player)
7. ✅ Playback works through global player (play/pause/seek/speed)
8. ✅ GlobalPlayer bottom bar stays in sync
9. ✅ Empty state shows when no history
10. ✅ Error state shows with retry
11. ✅ Favorites/Downloads/By Book tabs unchanged
12. ✅ No regression in Studio, Dashboard, My Books
13. ✅ Signed URLs fetched fresh on playback start (via `getChapterAudio`)
14. ✅ Audio generation metadata filtered by authenticated user