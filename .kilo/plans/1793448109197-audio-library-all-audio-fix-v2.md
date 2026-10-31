# Audio Library All Audio Fix – Revised Investigation Plan

## Exact failure point

Studio playback starts correctly, but `POST /api/library/playback/log` is never called, so no `playback_history` row is created. Audio Library → All Audio remains empty.

## Runtime evidence

* Database verification: `playback_history` table exists with correct columns, indexes, RLS policies. Record count = 0.
* `Dashboard.jsx` constructs `frontendBook` on load:
  ```js
  const frontendBook = { title, chapters, coverUrl };
  ```
  `id` is omitted. `book?.id` is therefore `undefined` for the entire Studio session.
* `useAudioPlayer` is instantiated with:
  ```js
  chapterId: chapter?.chapterId,
  bookId: book?.id, // undefined
  ```
* `onPlaybackVerified` callback guards with `if (!hasLoggedPlaybackRef.current && bookId && chapterId)`. `bookId` is falsy → callback never logs.
* No network request to `/api/library/playback/log` is observed for Studio playback.
* `GET /api/library/playback/history` returns empty array, so `AudioLibrary` renders “No played audio yet”.

## Root cause

`book.id` is not propagated to frontend state. The book object created from `getBookDetails` response discards the `id`. Consequently playback verification in Studio cannot log history because the required `bookId` is missing. Previous fixes for `hasLoggedPlaybackRef` and API enrichment are correct but ineffective while `bookId` remains undefined.

Secondary issues previously corrected but still relevant:
* `hasLoggedPlaybackRef` was undefined – now declared.
* `AudioLibrary.playChapter` was logging immediately – now removed.
* API enrichment for language/duration added – useful but not sufficient alone.

## Files requiring changes

1. `client/src/pages/Dashboard.jsx`
   * Include `id` when constructing `frontendBook` from API response.
   * Preserve `id` through subsequent `setBook` updates.
   * Optionally use `currentBookIdRef.current` as fallback for `bookId` in `useAudioPlayer`.

2. `client/src/pages/AudioLibrary.jsx`
   * Already updated: set `selectedChapterId` before play, removed immediate `logPlayback`.
   * No further changes required unless metadata mapping needs adjustment.

3. `server/src/routes/libraryRoutes.js`
   * Already enriched `GET /playback/history` with language/duration. Keep as is.

## Minimal corrective implementation plan

1. Database safety
   * Verify `playback_history` exists – already verified.
   * Do not apply migration again.

2. Studio book id propagation
   * In Dashboard book load effect, construct `frontendBook` with `id: res.book.id`.
   * Update all `setBook` updaters to spread existing `id`.
   * Ensure `useAudioPlayer` receives valid `bookId`.

3. Playback verification
   * Keep `hasLoggedPlaybackRef` with reset on chapter/book change.
   * Ensure `onPlaybackVerified` logs only after actual `play` event on shared audio element.

4. Audio Library history
   * Keep `logPlayback` removed from `AudioLibrary.playChapter`.
   * Keep `selectedChapterId` set before play for UI sync.

5. PlayerPanel metadata
   * Keep API enrichment; frontend mapping already uses returned `language`/`durationSeconds`.

6. Testing
   * Start playback in Studio → verify `POST /api/library/playback/log` 200 with correct `user_id`, `book_id`, `chapter_id`.
   * Verify row inserted in Supabase `playback_history`.
   * Open Audio Library → chapter appears in All Audio.
   * Refresh → persists.
   * Play from All Audio → right PlayerPanel plays correctly, no new history record created.
   * Pause/resume does not duplicate history.
   * Build passes.

## Regression risks

* Missing `id` in future `setBook` updates may reintroduce bug – ensure spreads preserve `id`.
* `currentBookIdRef` fallback may mask missing id – prefer explicit propagation.

## Validation steps

* Browser Network tab: `POST /api/library/playback/log` with 200.
* Supabase: `SELECT * FROM playback_history WHERE user_id = ...`.
* `GET /api/library/playback/history` returns non-empty array with language/duration.
* All Audio table renders row with correct metadata.
