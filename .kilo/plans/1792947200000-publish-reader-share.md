# Phase 4: "Publish to Reader" Share Flow — Implementation Plan

## Goal
Replace the dead "Publish to Ekithab Reader" stub with a working Share Dialog that lets users copy a public `/listen/:bookId` URL. A new `PublicListener` page reads that URL and plays the book with the ReadAlongPlayer.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | New frontend route `/listen/:bookId` → `PublicListener.jsx` | No existing page handles this; keep it separate from auth-gated Dashboard |
| D2 | No auth required on `/listen` — pure public read | Judges/hackathon attendees open the link on their phones |
| D3 | `ShareDialog` is a pure local component, no API calls | URL is constructed client-side from `window.location.origin` |
| D4 | ActionCard `onClick` replaces `disabled` on Publish card | Minimal change — just remove the `disabled` prop and add `onShare` |
| D5 | BookCard gets a share button inside the overflow menu | Uses existing `MoreHorizontal` icon already imported |

## Affected files

- `server/src/routes/storefrontRoutes.js` *(public route — MANDATORY, no RLS dependency)*
- `client/src/components/books/ShareDialog.jsx` *(new)*
- `client/src/pages/PublicListener.jsx` *(new)*
- `client/src/components/books/ActionCard.jsx`
- `client/src/components/books/BookCard.jsx`
- `client/src/pages/MyBooks.jsx`
- `client/src/App.jsx`

---

## Tasks

### 0. Backend: Public book endpoint (MANDATORY — execute first)
**File:** `server/src/routes/storefrontRoutes.js`

`/api/storefront` is already mounted WITHOUT `authMiddleware` (`server/src/index.js:90`) and gets wildcard CORS via the app-level delegate. The server's Supabase client uses the service-role key, so RLS never blocks it. No changes to `index.js` needed.

Add after the existing `/embed/:generationId` route (line 69):

```js
// GET /api/storefront/book/:bookId — public read-only book + chapters + audio.
// No auth by design (share links). Service-role key bypasses RLS.
router.get('/book/:bookId', embedLimiter, async (req, res) => {
  try {
    const { bookId } = req.params;

    if (!UUID_RE.test(bookId)) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, cover_url, total_chapters, completed_chapters, status, language')
      .eq('id', bookId)
      .maybeSingle();

    if (bookError) throw bookError;
    // Do not expose pending/processing/failed books — only completed (404 hides existence)
    if (!book || book.status !== 'completed') {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, sequence_number, title, text_content, char_count, estimated_duration_seconds, status')
      .eq('book_id', bookId)
      .eq('status', 'completed')
      .order('sequence_number', { ascending: true });

    if (chaptersError) throw chaptersError;

    // Latest completed generation per chapter (reruns create extra rows).
    // Guard: PostgREST rejects an empty .in() array.
    let generations = [];
    if (chapters && chapters.length > 0) {
      const { data: genData, error: genError } = await supabase
        .from('audio_generations')
        .select('chapter_uuid, audio_url, audio_path, duration, alignment, created_at')
        .in('chapter_uuid', chapters.map((c) => c.id))
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (genError) throw genError;
      generations = genData || [];
    }

    const latestByChapter = new Map();
    for (const gen of generations || []) {
      if (gen.chapter_uuid && !latestByChapter.has(gen.chapter_uuid)) {
        latestByChapter.set(gen.chapter_uuid, gen);
      }
    }

    const chaptersWithAudio = await Promise.all(
      (chapters || []).map(async (ch) => {
        const gen = latestByChapter.get(ch.id);
        const audioUrl = gen ? await resolveAudioUrl(gen) : null;
        return {
          id: ch.id,
          sequenceNumber: ch.sequence_number,
          title: ch.title,
          text: ch.text_content,
          durationSeconds: gen?.duration ?? null,
          alignment: gen?.alignment ?? [],
          audioUrl,
        };
      })
    );

    res.json({
      success: true,
      book: {
        id: book.id,
        title: book.title,
        coverUrl: book.cover_url,
        language: book.language,
        totalChapters: book.total_chapters,
      },
      chapters: chaptersWithAudio,
    });
  } catch (error) {
    console.error('GET /storefront/book/:bookId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

Notes for implementer:
- The empty-array `.in()` guard is included in the snippet above — do not remove it.
- `resolveAudioUrl` is already imported in this file (line 4).
- Signed URLs expire in 1h; listener sessions longer than that need a refresh (out of scope, note it).

### 0a. Frontend API helper
**File:** `client/src/services/api.js` — the `api` axios instance attaches an auth header via interceptor, but `/api/storefront` ignores it server-side, so reuse is safe:

```js
export function getPublicBook(bookId) {
  return api.get(`/api/storefront/book/${bookId}`).then((res) => res.data);
}
```

### 1. Create `ShareDialog` component
**File:** `client/src/components/books/ShareDialog.jsx` *(new file)*

```jsx
import React from 'react';
import { X, Link } from 'lucide-react';

export function ShareDialog({ isOpen, onClose, bookTitle, bookId }) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !bookId) return null;

  const shareUrl = `${window.location.origin}/listen/${bookId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
      const el = document.getElementById('share-url-input');
      el?.select();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl p-6 max-w-md w-full mx-4 relative shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Link className="h-5 w-5 text-terracotta" />
          <h2 className="text-lg font-semibold text-foreground">Share "{bookTitle}"</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Anyone with this link can listen to your audiobook on their device.
        </p>

        <div className="flex gap-2">
          <input
            id="share-url-input"
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground"
          />
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              copied
                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                : 'bg-terracotta text-background hover:opacity-90'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. Enable Publish to Reader in ActionCard
**File:** `client/src/components/books/ActionCard.jsx`

Add `onShare` prop alongside existing props. When `onClick` is present use it; otherwise fall back to `onShare`:

```jsx
export function ActionCard({ icon, title, description, onClick, onShare, disabled = false }) {
```

And change the button `onClick`:
```jsx
onClick={disabled ? undefined : (onClick ?? onShare)}
```

### 3. Add share button to BookCard
**File:** `client/src/components/books/BookCard.jsx`

Add `onShare` prop. The existing overflow menu (`MoreHorizontal`) only shows on hover via the group-hover overlay. Add a second button inside the hover overlay:

```jsx
<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2 px-4">
  <button
    onClick={onOpen}
    className="bg-background text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
  >
    Open
  </button>
  {onShare && (
    <button
      onClick={(e) => { e.stopPropagation(); onShare(); }}
      className="bg-terracotta text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
    >
      Share
    </button>
  )}
</div>
```

### 4. Wire state in MyBooks
**File:** `client/src/pages/MyBooks.jsx`

#### 4a. Add state (after line ~41)
```js
const [shareBook, setShareBook] = React.useState(null);
```

#### 4b. Enable the Publish ActionCard
Replace the disabled Publish card (lines 175–180). With zero books the handler shares nothing, so guard with an alert-free no-op: open the dialog only if there is a completed book; otherwise fall back to the first book (dialog backend 404s unpublished books anyway when opened):

```jsx
<ActionCard
  icon={<Upload className="h-6 w-6" />}
  title="Publish to Ekithab Reader"
  description="Share your audiobook with listeners and make it accessible everywhere."
  disabled={books.length === 0}
  onShare={() => {
    const target = books.find((b) => b.status === 'completed') || books[0];
    if (target) setShareBook(target);
  }}
/>
```

Per-book sharing (the primary flow) is wired on BookCard in 4c — the ActionCard is just the banner entry point for "share my best finished book".

#### 4c. Pass onShare to BookCard
In the grid map (around line 285):
```jsx
<BookCard
  key={book.id}
  book={book}
  onOpen={() => navigate(`/?bookId=${book.id}`)}
  onDelete={() => handleDelete(book.id)}
  onShare={() => setShareBook(book)}
/>
```

In the list view map (around line 296):
```jsx
<div
  key={book.id}
  className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
>
  ...
  <button
    onClick={() => setShareBook(book)}
    className="shrink-0 border border-border text-xs font-medium px-4 py-2 rounded-lg hover:bg-muted transition-colors"
  >
    Share
  </button>
  ...
</div>
```

#### 4d. Render ShareDialog at bottom of page
Before the closing `</div>` of the main layout (before the upload modal):
```jsx
<ShareDialog
  isOpen={!!shareBook}
  bookId={shareBook?.id}
  bookTitle={shareBook?.title}
  onClose={() => setShareBook(null)}
/>
```

### 5. Create `PublicListener` page
**File:** `client/src/pages/PublicListener.jsx` *(new file)*

Fetches the unified public payload from Step 0 via `getPublicBook` (NEVER the auth-gated `getBookDetails`/`getChapterAudio`). No auth. Receives `bookId` as a prop (no router library — no `useParams` exists). Uses `useNavigate` only after Step 6 wraps it in `NavigateContext.Provider`.

Data shape from Step 0: `{ success, book: { id, title, coverUrl, language, totalChapters }, chapters: [{ id, sequenceNumber, title, text, durationSeconds, alignment, audioUrl }] }`.

```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getPublicBook } from '../services/api.js';
import { ReadAlongPlayer } from '../components/player/ReadAlongPlayer.jsx';
import { useAudioPlayer } from '../hooks/useAudioPlayer.jsx';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PublicListener({ bookId }) {
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [audioResult, setAudioResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPublicBook(bookId);
        if (cancelled) return;
        if (!res?.success || !res.book) { setError('Book not found or not published yet'); setLoading(false); return; }
        setBook(res.book);
        setChapters(res.chapters || []);
        const first = res.chapters?.[0];
        if (first) setAudioResult({ audioUrl: first.audioUrl, alignment: first.alignment || [] });
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.status === 404
          ? 'Book not found or not published yet'
          : err.response?.data?.error || err.message || 'Failed to load book');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  const chapter = chapters[activeIdx];
  const player = useAudioPlayer(audioResult?.audioUrl, audioResult?.alignment || []);

  const selectChapter = (idx) => {
    setActiveIdx(idx);
    setAudioResult({
      audioUrl: chapters[idx]?.audioUrl || null,
      alignment: chapters[idx]?.alignment || [],
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading audiobook…</span>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-destructive mb-4">{error || 'Book not found'}</p>
        <button onClick={() => navigate('/')} className="text-sm text-terracotta hover:underline">
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-md hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{book.title}</p>
          <p className="text-xs text-muted-foreground">{chapters.length} chapters</p>
        </div>
      </header>

      {/* Chapter nav */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <button
          onClick={() => selectChapter(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          className="p-1 rounded hover:bg-muted disabled:opacity-40"
          aria-label="Previous chapter"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs text-muted-foreground flex-1 text-center truncate">
          {activeIdx + 1} / {chapters.length} · {chapter?.title}
        </span>
        <button
          onClick={() => selectChapter(Math.min(chapters.length - 1, activeIdx + 1))}
          disabled={activeIdx === chapters.length - 1}
          className="p-1 rounded hover:bg-muted disabled:opacity-40"
          aria-label="Next chapter"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Player */}
      <main className="flex-1 overflow-y-auto p-4">
        <ReadAlongPlayer
          audioUrl={audioResult?.audioUrl}
          alignment={audioResult?.alignment || []}
          chapterText={chapter?.text}
          currentTime={player.currentTime}
          currentSentenceIndex={player.currentSentenceIndex}
          onSeek={(s) => player.seek(s)}
        />
      </main>

      {/* Playback controls (public page has no BottomPlayer) */}
      <footer className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-center gap-4">
        <button
          onClick={() => (player.isPlaying ? player.pause() : player.play())}
          className="bg-terracotta text-background w-12 h-12 rounded-full flex items-center justify-center hover:opacity-90"
          aria-label={player.isPlaying ? 'Pause' : 'Play'}
        >
          {player.isPlaying ? '⏸' : '▶'}
        </button>
      </footer>
    </div>
  );
}
```

### 6. Wire `/listen/:bookId` into App.jsx
**File:** `client/src/App.jsx`

Three traps in the current App.jsx that MUST be handled (verified in code):

1. **Auth guard redirect** (lines 28–38): unauthenticated visitors on any path except `/login`/`/register` get redirected to `/login`. Anonymous judges with a share link would never reach the reader → the guard must skip `/listen/` paths.
2. **`useNavigate` throws outside its provider** (`NavigateContext.jsx:7`): `PublicListener` calls `useNavigate`, so it must be wrapped in `NavigateContext.Provider`.
3. **No router library**: extract `bookId` from the path manually and pass as a prop.

Changes:

```jsx
import PublicListener from './pages/PublicListener.jsx';
```

In the auth-redirect `useEffect` (line 28), skip the guard for listener paths:

```jsx
useEffect(() => {
  if (loading) return;
  if (path.startsWith('/listen/')) return; // public share links bypass auth
  const params = new URLSearchParams(window.location.search);
  const hasBookId = params.get('bookId') !== null;
  // ... rest unchanged
}, [session, loading, path, navigate]);
```

Render branch — place BEFORE the `if (loading)` block (so anonymous users never sit on the auth spinner) by adding at the top of the component's return logic, right after the `useCallback`/`useEffect` hooks:

```jsx
if (path.startsWith('/listen/')) {
  const bookId = path.slice('/listen/'.length).split('/')[0];
  return (
    <NavigateContext.Provider value={navigate}>
      <PublicListener bookId={bookId} />
    </NavigateContext.Provider>
  );
}
```

(`bookId` is unvalidated client-side; the backend Step 0 route UUID-checks it and 404s garbage.)

---

## Validation
1. `npm run build` in `client/` and `node --check server/src/routes/storefrontRoutes.js`.
2. `curl http://localhost:4001/api/storefront/book/<completed-book-uuid>` with NO Authorization header → 200 with `chapters[].audioUrl` populated.
3. Same route with a `pending`/`processing` book uuid and with a garbage uuid → both 404.
4. Open My Books → hover a completed book card → "Share" appears → dialog shows `${origin}/listen/<id>` → Copy shows "✓ Copied!" for 2s.
5. Open the copied URL in an incognito window (logged out) → reader loads, play works, sentence highlighting syncs, chapter arrows work.
6. Logged-out visit to `/listen/<nonexistent>` → "Book not found or not published yet" + Back to Home.

## Failure modes & rollback
- **No audio for a chapter** → ReadAlongPlayer falls back to raw text / "No synchronization data available".
- **Book deleted or unpublished while link is live** → backend 404 → friendly error page with back link.
- **Signed URL expiry (1h)** → long listener sessions lose audio mid-playback; upgrade path: re-fetch `getPublicBook` on `audio` error event.
- **Empty-chapter array into `.in()`** → PostgREST error; guarded in Step 0 (skip generations query when no chapters).
- **Auth guard regression** → verify logged-in users still redirect `/` → `/my-books`; `/listen/` bypass only skips the guard, nothing else.

## Out of scope
- QR code generation for the share link (judges can paste the URL).
- Signed-URL refresh during long listening sessions.
- Password-protected / expiring share links.
- Analytics on shared-link opens.
