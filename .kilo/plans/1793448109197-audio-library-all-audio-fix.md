# Audio Library All Audio Fix – Implementation Plan

## 1. Root cause of missing playback history

- **Database table missing.** Migration `server/migrations/011_create_playback_history.sql` exists but is not included in `apply-all.sql`/`pending.sql`. `playback_history` table is absent in Supabase, so `GET /api/library/playback/history` returns 500 and `AudioLibrary` loads zero items → “No played audio yet”.
- **Studio playback logging broken.** `Dashboard.jsx` uses `onPlaybackVerified` from `useAudioPlayer`. The callback references `hasLoggedPlaybackRef.current` but `hasLoggedPlaybackRef` is never declared in the component. ReferenceError prevents `logPlayback` from executing, so no history rows are created even when playback starts correctly.
- **All Audio list uses wrong data source.** `AudioLibrary` loads history via `getPlaybackHistory` but maps response to items with `voiceName` defaulted and `durationSeconds` from a field that the endpoint does not return. Endpoint returns `bookId/chapterId/title/cover/sequenceNumber` only. No `language`, `durationSeconds`, `voice` → PlayerPanel shows `Chapter undefined • 0:00`, missing cover details.
- **Playback verification not enforced on library play.** `AudioLibrary.playChapter` calls `logPlayback` immediately after `play()`, without waiting for actual audio start. This violates the requirement that only verified playback starts create history and creates duplicate/ premature records.

## 2. Why Studio playback is not appearing in All Audio

Flow break points:
1. Studio → `BottomPlayer` uses shared `AudioContext` – OK.
2. `useAudioPlayer` attaches `play` event listener to shared audio element and fires `onPlaybackVerified` once per chapter session – OK.
3. `Dashboard.jsx` `onPlaybackVerified` callback → `hasLoggedPlaybackRef` undefined → throws → `logPlayback` never called.
4. Even if logging succeeded, `GET /api/library/playback/history` would fail with 500 because table missing.
5. `AudioLibrary` loads history, but response shape lacks language/duration/voice, and no selection is set when row play button is used → `PlayerPanel` receives AudioContext chapter which lacks metadata fields → UI shows undefined.

## 3. Database and API verification findings

- **Schema:**
  - `playback_history` table not present in DB. Migration SQL verified in repo.
  - `audio_generations` has `duration`, `language`, `chapter_uuid/chapter_id`, `status`.
  - `chapters` has `language`, `estimated_duration_seconds`, `sequence_number`.
  - `books` has `cover_url`.
- **Endpoints:**
  - `POST /api/library/playback/log` verifies ownership and existence of completed `audio_generations` then upserts to `playback_history` with unique `(user_id,chapter_id)`. Correct.
  - `GET /api/library/playback/history` selects `playback_history` + `books.title/cover_url` + `chapters.title/sequence_number`. Does **not** return `language`, `duration`, `voice`. By-book endpoint does return `language` and `estimated_duration_seconds`.
- **API client:**
  - `getPlaybackHistory` → `/api/library/playback/history`.
  - `logPlayback` → `/api/library/playback/log`.
  - `getChapterAudio` → returns `audioUrl`, `durationSeconds`, `alignment`.

## 4. Exact files/functions requiring changes

**Backend – minimal:**
- Apply migration `011_create_playback_history.sql` to Supabase. No code change required.
- Optionally extend `GET /api/library/playback/history` to include `chapters.language` and `audio_generations.duration/language` for richer UI. Keep backward compatible.

**Frontend:**
- `client/src/pages/Dashboard.jsx` – declare `hasLoggedPlaybackRef` with `useRef(false)` and reset on chapter change; ensure `onPlaybackVerified` is idempotent.
- `client/src/pages/AudioLibrary.jsx`:
  - Set `selectedChapterId` when playing a row.
  - Remove immediate `logPlayback` call from `playChapter`. Playback logging must originate from verified Studio playback only.
  - Ensure `displayChapter` resolution prefers metadata-rich item from `items` over raw `globalActiveChapter`.
  - Enrich history items on load with language/duration from `audio_generations` or chapters to populate PlayerPanel.
- `client/src/components/audioLibrary/PlayerPanel.jsx` – tolerate missing fields, fallback to item metadata.
- `client/src/components/audioLibrary/AudioRow.jsx` – no change required but ensure play button also selects row for metadata sync.
- `client/src/hooks/useAudioPlayer.jsx` – no change; already uses shared AudioContext.

## 5. Minimal frontend/backend changes

**Backend:**
1. Run safe migration for `playback_history` (idempotent CREATE TABLE + indexes + policies).
2. No route changes required for core fix. Optional: enrich `GET /playback/history` response with `language` and `durationSeconds` from latest `audio_generations`.

**Frontend:**
1. Fix `Dashboard.jsx` undefined ref.
2. In `AudioLibrary.playChapter`:
   - Set `setSelectedChapterId(chapterId)` before `play`.
   - Remove `logPlayback` call; playback verification stays in Studio.
3. In `loadPlaybackHistory`, after fetching history, fetch missing metadata (language/duration/voice) per item via existing `getChapterAudio` or extend API. Keep cache.
4. Ensure row play and PlayerPanel play/pause stay synchronized via `AudioContext` state and `selectedChapterId`.
5. Prevent duplicate history records – rely on DB unique index and existing upsert.

## 6. Row and PlayerPanel synchronization approach

- Single authoritative audio element: `AudioContext` `audioRef`.
- `activeChapterId` = `globalActiveChapter?.chapterId || selectedChapterId`.
- Row `isActive` and `isPlaying` derived from source above.
- When user clicks play on row:
  - Set `selectedChapterId` → PlayerPanel shows metadata from `items`.
  - Call `playChapter` which loads audio URL and calls `AudioContext.play`.
- When user clicks play/pause in PlayerPanel:
  - Calls `handlePlayPause` which uses `AudioContext.play/pause`.
  - Row reflects state via shared `isPlaying`.
- Switching chapters: new play stops previous via `AudioContext` src change; `selectedChapterId` updates.

## 7. Duplicate playback/history prevention

- DB unique index `(user_id, chapter_id)` on `playback_history`.
- `POST /playback/log` uses upsert with `onConflict`.
- `useAudioPlayer` resets `hasLoggedPlaybackRef` on `audioUrl/chapterId/bookId` change and fires `onPlaybackVerified` once per session.
- Remove logging from `AudioLibrary.playChapter` to avoid logging library-initiated plays.
- Dashboard callback now guards with local ref and retries once.

## 8. Regression risks and testing plan

**Risks:**
- Migration applied to production DB – idempotent SQL mitigates.
- Changing `selectedChapterId` timing may cause flash of wrong cover – mitigate by setting before play.
- Enriching history may increase requests – use cache.

**Acceptance tests:**
1. Generate without playing → chapter not in All Audio.
2. Play chapter in Studio → `playback_history` row created.
3. Open Audio Library → played chapter appears in All Audio table.
4. Refresh → persists.
5. Row Play → audio plays in right PlayerPanel with correct cover/title/chapter/ duration/language/voice.
6. Row Play/Pause sync with PlayerPanel controls.
7. Playing another row stops previous.
8. Seek, speed, Previous/Next, Download, Open in Studio, Favorite work.
9. Studio BottomPlayer unchanged.
10. Favorites, By Book, Downloads unaffected.
11. No duplicate Audio elements.
12. Build + TypeScript pass.

## Out of scope
- No Global Bottom Player reintroduction.
- No redesign of Studio or Audio Library UI.
- No new tables beyond applying existing migration.
- No changes to Home/My Books/Recent/Settings.

---
Plan ready for approval before implementation.
