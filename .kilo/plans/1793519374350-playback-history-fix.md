# Fix Studio Playback History — Plan

## Root Cause

**Primary bug** in `server/src/routes/libraryRoutes.js` lines 206–217: the `.or()` query is chained **after** `.limit(1)`, which causes the Supabase JS client to apply the limit before the OR condition is integrated into the query. This means the audio-generation verification silently fails for UUID chapter IDs, returning no results, and the backend returns `400 "Chapter has no generated audio"` — so the playback record is never inserted.

Evidence: `server/src/routes/audioRoutes.js` lines 36–47 uses the **correct** ordering (`or()` before `limit(1).single()`). `libraryRoutes.js` inverted this order.

**Secondary issue**: `AudioLibrary.jsx` loads history only on mount (`useEffect` with empty deps). If the user plays a chapter and navigates back, the page relies on React remounting the component. Adding a `visibilitychange` listener ensures freshness regardless of routing behavior.

**Tertiary issue (server startup)**: `server/src/services/llmDirector.js` instantiates `new Groq({ apiKey: process.env.GROQ_API_KEY })` at module load time (line 3). When `GROQ_API_KEY` is not set in `.env`, the server crashes on startup with `GroqError: The GROQ_API_KEY environment variable is missing or empty`. This must be fixed before any other server changes can be tested.

## Changes

### 0. `server/src/services/llmDirector.js` — Fix server startup crash

Make the Groq client instantiation lazy (only when `generateSpatialScript` is actually called), and throw a clear error if the API key is missing when spatial audio is requested.

```javascript
// BEFORE (broken — crashes on import)
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// AFTER (fixed — lazy instantiation)
import Groq from 'groq-sdk';

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set — spatial audio generation unavailable');
  }
  return new Groq({ apiKey });
}
```

Then inside `generateSpatialScript`, replace `groq.chat.completions.create` with `getGroqClient().chat.completions.create`.

### 1. `server/src/routes/libraryRoutes.js` — Fix the audio-generation query (lines 204–219)

Replace the current query builder chain that calls `.or()` after `.limit(1)` with the correct pattern used in `audioRoutes.js`: call `.or()` **before** `.limit(1).single()`.

```javascript
// BEFORE (broken)
let audioQuery = supabase
  .from('audio_generations')
  .select('id')
  .eq('user_id', userId)
  .eq('status', 'completed')
  .limit(1);                         // ← limit applied BEFORE or()

if (isUuid) {
  audioQuery = audioQuery.or(`chapter_uuid.eq.${chapterId},chapter_id.eq.${chapterId}`);
} else {
  audioQuery = audioQuery.eq('chapter_id', chapterId);
}
const { data: audioGen, error: audioError } = await audioQuery.single();

// AFTER (fixed — matches audioRoutes.js pattern)
let audioQuery = supabase
  .from('audio_generations')
  .select('id')
  .eq('user_id', userId)
  .eq('status', 'completed');

if (isUuid) {
  audioQuery = audioQuery.or(`chapter_uuid.eq.${chapterId},chapter_id.eq.${chapterId}`);
} else {
  audioQuery = audioQuery.eq('chapter_id', chapterId);
}

const { data: audioGen, error: audioError } = await audioQuery.limit(1).single();
```

### 2. `server/src/routes/libraryRoutes.js` — Harden the upsert (lines 226–238)

The `.upsert()` with composite `onConflict: 'user_id,chapter_id'` may not behave correctly across Supabase JS client versions. Replace with an explicit upsert using `onConflict` on the unique index name, or fall back to insert-then-update pattern.

Preferred approach — use the index name directly:

```javascript
const { data, error } = await supabase
  .from('playback_history')
  .upsert(
    {
      user_id: userId,
      book_id: bookId,
      chapter_id: chapterId,
      last_played_at: new Date().toISOString(),
    },
    {
      onConflict: 'playback_history_user_chapter_uidx',
    }
  )
  .select()
  .single();
```

If the index-name approach fails, fall back to:
```javascript
const { data: existing } = await supabase
  .from('playback_history')
  .select('id')
  .eq('user_id', userId)
  .eq('chapter_id', chapterId)
  .single();

let result;
if (existing) {
  result = await supabase
    .from('playback_history')
    .update({ last_played_at: new Date().toISOString() })
    .eq('id', existing.id)
    .select()
    .single();
} else {
  result = await supabase
    .from('playback_history')
    .insert({ user_id: userId, book_id: bookId, chapter_id: chapterId, last_played_at: new Date().toISOString() })
    .select()
    .single();
}
const { data, error } = result;
```

### 3. `client/src/pages/AudioLibrary.jsx` — Add visibility-based refresh

Add a `visibilitychange` listener so that when the user returns to the Audio Library tab (from Studio or any other page), the playback history and by-book data are re-fetched automatically.

```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      loadPlaybackHistory();
      if (activeTab === 'by-book') {
        loadByBook();
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [loadPlaybackHistory, loadByBook, activeTab]);
```

Also add a manual refresh button in `LibraryTopBar.jsx` so the user can explicitly reload data.

### 4. `client/src/components/audioLibrary/LibraryTopBar.jsx` — Add refresh button

Add a small refresh icon button next to the book filter dropdown that calls `onRetry` (passed from `AudioLibrary.jsx`).

## Files Modified

| File | Change |
|------|--------|
| `server/src/services/llmDirector.js` | Lazy Groq client instantiation to prevent startup crash |
| `server/src/routes/libraryRoutes.js` | Fix `.or()` query ordering; harden upsert |
| `client/src/pages/AudioLibrary.jsx` | Add `visibilitychange` refresh listener |
| `client/src/components/audioLibrary/LibraryTopBar.jsx` | Add refresh button |

## Validation Plan

0. **Server startup**: Run `npm run dev` in `server/`. Confirm server starts without GroqError. If spatial audio is not needed for testing, the lazy instantiation ensures the server runs even without `GROQ_API_KEY`.

1. **Test 1 — First book**: Open book A in Studio, generate audio, play Chapter 1. Verify `POST /api/library/playback/log` succeeds (200). Open Audio Library → confirm book A appears in All Audio and By Book.

2. **Test 2 — Different book**: Open book B (`tel`) in Studio, generate audio, play Chapter 1. Verify the API request succeeds. Open Audio Library → confirm book B appears as a separate card in By Book and as a row in All Audio.

3. **Test 3 — Replay**: Replay a previously played chapter. Verify the existing `playback_history` row is updated (`last_played_at` changes) rather than duplicated.

4. **Test 4 — UI refresh**: Play a chapter in Studio, navigate to Audio Library without manual reload. Verify data appears automatically (via `visibilitychange` listener).

5. **Test 5 — Existing functionality**: Verify Favorites, Downloads, chapter expansion in By Book, and PlayerPanel synchronization all continue to work.

6. **Build**: Run `npm run build` in `client/` to confirm no type/errors.
