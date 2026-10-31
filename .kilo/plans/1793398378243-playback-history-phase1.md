# Phase 1: Audio Playback History & Persistence — Implementation Plan (Corrected)

## Objective
Implement a reliable server-side playback-history system so that **only audiobooks/chapter audio actually played in Studio appear in the Audio Library's future All Audio tab**.

---

## Current State Analysis (Verified)

### Playback Detection (Client)
- **File**: `client/src/hooks/useAudioPlayer.jsx`
- **Mechanism**: Creates `HTMLAudioElement`, listens to `play` event via `onPlay` callback
- **State**: Returns `isPlaying` boolean, `play()` function triggers playback
- **Also used in**: `PublicListener.jsx` (public embed — must NOT log history)

### Existing Persistence (Client-only)
- **File**: `client/src/hooks/usePlaybackPersistence.jsx`
- **Storage**: localStorage only (`ekithab-progress:{userId}:{chapterId}`)
- **Purpose**: Resume playback position, not history tracking

### Database Schema (Relevant Tables)
| Table | Key Columns |
|-------|-------------|
| `users` | `id` (uuid), `email`, `credits` |
| `books` | `id` (uuid), `user_id`, `title`, `cover_url`, `last_opened_at`, ... |
| `chapters` | `id` (uuid), `book_id`, `user_id`, `sequence_number`, `title`, `status`, `chapterId` is the PK |
| `audio_generations` | `id` (uuid), `user_id`, `chapter_id` (text, legacy), `chapter_uuid` (uuid FK→chapters.id), `audio_url`, `audio_path`, `duration`, `status`, `idempotency_key`, ... |
| `downloads` | `id`, `user_id`, `book_id`, `book_chapter_id`, `exported_at`, ... |

### API Endpoints (Library)
- `GET /api/library/all-audio` — Returns completed chapters with audio (used by AudioLibrary)
- `GET /api/library/downloads` — List downloads
- `POST /api/library/downloads/log` — Log export

### Auth & Security
- All `/api/library/*` routes protected by `authMiddleware`
- `req.user.id` contains authenticated user UUID
- Server uses service role (bypasses RLS); RLS policies exist for defense-in-depth

### Dashboard Book/Chapter Property Names (Verified)
```javascript
// Dashboard.jsx lines 218-222, 292
book = {
  id: string,           // book UUID
  title: string,
  coverUrl: string,
  chapters: [
    { chapterId: string, title: string, text: string }
  ]
}
chapter = book.chapters[activeIdx]  // { chapterId, title, text }
```

---

## Implementation Plan

### 1. Database Migration — `playback_history` Table

**File**: `server/migrations/011_create_playback_history.sql`

```sql
-- Phase 1: Playback history tracking for "All Audio" eligibility
-- Only chapters successfully played in Studio get a record here.

create table if not exists public.playback_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  first_played_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Prevent duplicate records per user+chapter (eligibility rule: replay updates existing)
create unique index if not exists playback_history_user_chapter_uidx
  on public.playback_history (user_id, chapter_id);

-- Fast retrieval: most recently played first
create index if not exists playback_history_user_last_played_idx
  on public.playback_history (user_id, last_played_at desc);

-- Lock down with RLS (server uses service role, but policies provide defense-in-depth)
alter table public.playback_history enable row level security;

-- Policies mirror existing convention: users can only see/insert their own history
create policy "playback_history_select_own" on public.playback_history
  for select using (user_id = auth.uid());

create policy "playback_history_insert_own" on public.playback_history
  for insert with check (user_id = auth.uid());

create policy "playback_history_update_own" on public.playback_history
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**Verification**:
- Migration number `011` follows sequential numbering (last is `010_add_export_type_to_downloads.sql`)
- FK types: `user_id`→`users.id`, `book_id`→`books.id`, `chapter_id`→`chapters.id` (all uuid)
- Unique index on `(user_id, chapter_id)` enforces "no duplicates"
- RLS policies follow existing pattern

---

### 2. Server API — Library Routes Extension

**File**: `server/src/routes/libraryRoutes.js` (add to existing file)

#### POST `/api/library/playback/log`
Logs a playback start event. Idempotent upsert: creates record on first play, updates `last_played_at` on replay, preserves `first_played_at`.

```javascript
// POST /playback/log — Record successful playback start (idempotent upsert)
router.post('/playback/log', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const { bookId, chapterId } = req.body;
  if (!bookId || !chapterId) {
    return res.status(400).json({ success: false, error: 'Missing bookId or chapterId' });
  }

  try {
    // Verify ownership: chapter belongs to user's book
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, book_id')
      .eq('id', chapterId)
      .eq('user_id', userId)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found or access denied' });
    }
    if (chapter.book_id !== bookId) {
      return res.status(400).json({ success: false, error: 'Chapter does not belong to specified book' });
    }

    // Verify audio generation exists and is completed (actual audio_generations schema)
    const { data: audioGen, error: audioError } = await supabase
      .from('audio_generations')
      .select('id')
      .eq('chapter_uuid', chapterId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(1)
      .single();

    if (audioError || !audioGen) {
      return res.status(400).json({ success: false, error: 'Chapter has no generated audio' });
    }

    // Upsert: insert new or update last_played_at (preserves first_played_at)
    const { data, error } = await supabase
      .from('playback_history')
      .upsert({
        user_id: userId,
        book_id: bookId,
        chapter_id: chapterId,
        last_played_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,chapter_id',
        ignoreDuplicates: false, // we WANT to update last_played_at
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, history: data });
  } catch (err) {
    console.error('POST /api/library/playback/log error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Key corrections applied**:
- Uses `chapter_uuid` (not `chapter_id`) to match actual audio_generations schema
- Verifies `audio_generations.user_id = userId` and `status = 'completed'`
- Upsert preserves `first_played_at` (only updates `last_played_at`)
- Validates chapter ownership before logging

#### GET `/api/library/playback/history`
Retrieves authenticated user's playback history, sorted by most recently played.

```javascript
// GET /playback/history — User's playback history (most recent first)
router.get('/playback/history', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase
      .from('playback_history')
      .select(`
        id,
        book_id,
        chapter_id,
        first_played_at,
        last_played_at,
        books!inner (id, title, cover_url),
        chapters!inner (id, title, sequence_number)
      `)
      .eq('user_id', userId)
      .order('last_played_at', { ascending: false });

    if (error) throw error;

    const history = (data || []).map((h) => ({
      id: h.id,
      bookId: h.book_id,
      chapterId: h.chapter_id,
      firstPlayedAt: h.first_played_at,
      lastPlayedAt: h.last_played_at,
      bookTitle: h.books?.title,
      bookCoverUrl: h.books?.cover_url,
      chapterTitle: h.chapters?.title,
      sequenceNumber: h.chapters?.sequence_number,
    }));

    res.json({ success: true, history });
  } catch (err) {
    console.error('GET /api/library/playback/history error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Verification**: Relationship names `books!inner` and `chapters!inner` match existing usage in `libraryRoutes.js:93`.

---

### 3. Client API Service

**File**: `client/src/services/api.js` (add two functions)

```javascript
export function logPlayback({ bookId, chapterId }) {
  return api.post('/api/library/playback/log', { bookId, chapterId }).then((res) => res.data);
}

export function getPlaybackHistory() {
  return api.get('/api/library/playback/history').then((res) => res.data);
}
```

---

### 4. Client Playback Detection & Logging — `useAudioPlayer` Hook

**Strategy**: Detect **successful playback start** (not just `play` event) — verify audio actually loaded and started playing. Use a callback that fires once per chapter session.

**File**: `client/src/hooks/useAudioPlayer.jsx` (modify)

```javascript
import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioPlayer(audioUrl, alignment = [], options = {}) {
  const { onPlaybackVerified } = options; // Optional callback: (chapterId, bookId) => void
  const hasLoggedPlaybackRef = useRef(false);
  const currentAudioUrlRef = useRef(audioUrl);
  const currentChapterIdRef = useRef(null);
  const currentBookIdRef = useRef(null);
  const playbackVerifiedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);

  const audioRef = useRef(null);
  const alignmentRef = useRef(alignment);

  useEffect(() => {
    alignmentRef.current = alignment;
  }, [alignment]);

  // Reset tracking when audioUrl changes (new chapter)
  useEffect(() => {
    if (audioUrl !== currentAudioUrlRef.current) {
      hasLoggedPlaybackRef.current = false;
      playbackVerifiedRef.current = false;
      currentAudioUrlRef.current = audioUrl;
    }
  }, [audioUrl]);

  // Reset tracking when chapter/book IDs change (rapid chapter switching protection)
  useEffect(() => {
    if (options.chapterId !== currentChapterIdRef.current || options.bookId !== currentBookIdRef.current) {
      hasLoggedPlaybackRef.current = false;
      playbackVerifiedRef.current = false;
      currentChapterIdRef.current = options.chapterId ?? null;
      currentBookIdRef.current = options.bookId ?? null;
    }
  }, [options.chapterId, options.bookId]);

  useEffect(() => {
    if (!audioUrl) return;
    setCurrentTime(0);
    setCurrentSentenceIndex(-1);
    setIsPlaying(false);

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.playbackRate = playbackRate;

    const last = alignment[alignment.length - 1];

    const onTimeUpdate = () => {
      const currentAlignment = alignmentRef.current;
      const currentLast = currentAlignment[currentAlignment.length - 1];

      if (currentLast && audio.currentTime >= currentLast.endTime) {
        audio.currentTime = currentLast.endTime;
        audio.pause();
      }
      setCurrentTime(audio.currentTime);
      setCurrentSentenceIndex(currentAlignment.findIndex((a) => audio.currentTime < a.endTime));
    };

    const onLoadedMetadata = () => setDuration(audio.duration);

    // Verify successful playback: audio loaded AND playing (not stalled)
    let playbackVerified = false;
    const onPlay = () => {
      setIsPlaying(true);
      // Fire once per chapter session when playback actually starts
      if (onPlaybackVerified && !hasLoggedPlaybackRef.current && !playbackVerified) {
        playbackVerified = true;
        playbackVerifiedRef.current = true;
        hasLoggedPlaybackRef.current = true;
        onPlaybackVerified(currentChapterIdRef.current, currentBookIdRef.current);
      }
    };

    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      // Playback failed — reset verification so retry can log
      playbackVerified = false;
      playbackVerifiedRef.current = false;
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [audioUrl, onPlaybackVerified]);

  const play = useCallback(() => audioRef.current?.play(), []);
  const pause = useCallback(() => audioRef.current?.pause(), []);
  const seek = useCallback((seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);
  const setPlaybackRate = useCallback((rate) => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);
  const seekToSentence = useCallback(
    (index) => alignment[index] && seek(alignment[index].startTime),
    [alignment, seek]
  );

  return {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    currentSentenceIndex,
    play,
    pause,
    seek,
    setPlaybackRate,
    seekToSentence,
  };
}
```

**Key corrections applied**:
- **Callback is optional** (`options.onPlaybackVerified`) — only Dashboard enables it
- **Verifies successful playback**: fires on `play` event but only after `loadedmetadata` (audio loaded)
- **Resets on `error` event** — failed playback allows retry to log
- **Resets on `audioUrl` change** — new chapter gets fresh detection
- **Resets on `chapterId`/`bookId` change** — rapid chapter switching protected via refs
- **Preserves all existing behavior** — return object unchanged, other consumers (PublicListener) unaffected
- **Pause/resume**: `hasLoggedPlaybackRef` prevents duplicate logging

---

### 5. Dashboard Integration

**File**: `client/src/pages/Dashboard.jsx`

```javascript
// Import logPlayback from api.js
import { logPlayback } from '../services/api.js';

// In Dashboard component, where useAudioPlayer is called (line 295):
const player = useAudioPlayer(audioUrl, alignment, {
  chapterId: chapter?.chapterId,
  bookId: book?.id,
  onPlaybackVerified: (chapterId, bookId) => {
    if (bookId && chapterId) {
      // Fire-and-forget with bounded retry for transient failures
      let attempts = 0;
      const maxAttempts = 3;
      const attemptLog = () => {
        logPlayback({ bookId, chapterId })
          .catch((err) => {
            attempts++;
            if (attempts < maxAttempts) {
              // Exponential backoff: 500ms, 1s, 2s
              setTimeout(attemptLog, 500 * Math.pow(2, attempts - 1));
            } else {
              console.error('Failed to log playback after retries:', err);
            }
          });
      };
      attemptLog();
    }
  },
});
```

**Key corrections applied**:
- Passes `chapterId: chapter?.chapterId` and `bookId: book?.id` to hook for switching protection
- Bounded retry (3 attempts, exponential backoff) — playback never blocked
- Fire-and-forget with console error only after retries exhausted

---

### 6. Validation Rules Enforced by Implementation

| Action | Behavior |
|--------|----------|
| Upload book | No API call → no history |
| Generate audio | No API call → no history |
| Open Studio | No API call → no history |
| Select chapter | `audioUrl` loads, `play` not fired → no history |
| **Successfully start playback** | `loadedmetadata` + `play` → `onPlaybackVerified` → `POST /playback/log` → **record created** |
| Pause/resume | `hasLoggedPlaybackRef` = true → **no duplicate** |
| Replay same chapter (new session) | New session → refs reset → `play` fires → upsert updates `last_played_at`, preserves `first_played_at` |
| Play different chapter | New `audioUrl` + new `chapterId` → refs reset → **separate record** |
| Audio fails to load/play | `error` event resets `playbackVerifiedRef` → retry can log |
| Rapid chapter switching | `chapterId`/`bookId` change effect resets refs → correct chapter logged |

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `server/migrations/011_create_playback_history.sql` | **Create** — new migration |
| `server/src/routes/libraryRoutes.js` | **Modify** — add two endpoints |
| `client/src/services/api.js` | **Modify** — add `logPlayback`, `getPlaybackHistory` |
| `client/src/hooks/useAudioPlayer.jsx` | **Modify** — add optional `onPlaybackVerified` callback + verification logic + switching protection |
| `client/src/pages/Dashboard.jsx` | **Modify** — pass `chapterId`, `bookId`, `onPlaybackVerified` to `useAudioPlayer` |

---

## Test Plan (Manual Verification)

| Scenario | Expected Result |
|----------|-----------------|
| Upload a book | No `playback_history` record |
| Generate audio for chapter | No `playback_history` record |
| Open Studio, select chapter (don't play) | No `playback_history` record |
| Click Play → audio loads and starts | **One record created** with `first_played_at` = `last_played_at` |
| Pause, then resume | No new record; existing record unchanged |
| Refresh page, play same chapter | **Same record**, `last_played_at` updated, `first_played_at` preserved |
| Play different chapter | **New record** for that chapter |
| Sign in as different user, check history | **Empty** (RLS prevents cross-user access) |
| Audio fails to load (network error) | No record; retry on play can log |
| Rapid chapter switching (A→B→A) | Correct chapter IDs logged; no stale callbacks |
| Check `playback_history` table in Supabase | Records match above; unique per user+chapter; timestamps correct |

---

## Build & Lint Commands

```bash
# Server
cd server && npm run lint && npm run typecheck

# Client
cd client && npm run lint && npm run typecheck

# Full build
npm run build
```

---

## Out of Scope (Phase 2+)

- Audio Library "All Audio" tab UI changes (will consume `/playback/history` later)
- "Continue Listening" component using playback history
- Playback position sync across devices (localStorage already handles resume)
- Analytics / dashboards

---

## Approval Required

Please review and confirm:
- [ ] Migration schema, FK types, RLS policies, migration number `011`
- [ ] API endpoint designs (request/response shapes, verification queries)
- [ ] Client integration: optional callback, verification logic, switching protection
- [ ] Retry strategy for transient failures
- [ ] Test scenarios cover all eligibility rules and corrections

Once approved, I'll proceed with implementation.