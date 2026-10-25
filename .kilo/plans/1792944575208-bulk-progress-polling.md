# Phase 2: Bulk Progress Polling & Status Dots — Implementation Plan

## Goal
Surface real-time synthesis progress: a lightweight backend status endpoint, 5-second polling in Dashboard, and colored status dots in the chapter sidebar.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | New route `GET /:bookId/status` — separate from `GET /:bookId` | Keeps status queries lightweight; no chapter text/IDs needed |
| D2 | Poll every 5s only when `book.status === 'processing'` | Already present on `book` object after `generateAll()` sets `isBulk` |
| D3 | Map backend `chapters[].id` to frontend `chapterId` in poll result | Frontend consistently uses `chapterId` as the Sidebar key |
| D4 | Sidebar reads `ch.status` directly — no extra prop drilling | `book.chapters` already holds status after initial load + poll updates |
| D5 | Progress strip rendered inside Dashboard's `studioContent` above the tabs | Simplest placement; visible whenever status is processing |

## Affected files

- `server/src/routes/studioRoutes.js`
- `client/src/pages/Dashboard.jsx`
- `client/src/components/layout/Sidebar.jsx`

---

## Tasks

### 1. Backend: `GET /:bookId/status`
**File:** `server/src/routes/studioRoutes.js`  
Insert **before** the existing `GET /:bookId` handler (line 289).

```js
// GET /:bookId/status — lightweight progress snapshot
router.get('/:bookId/status', async (req, res) => {
  try {
    const { bookId } = req.params;

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, status, completed_chapters, total_chapters')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, status')
      .eq('book_id', bookId)
      .order('sequence_number', { ascending: true });

    if (chaptersError) throw chaptersError;

    res.json({
      success: true,
      book: {
        status: book.status,
        completed_chapters: book.completed_chapters,
        total_chapters: book.total_chapters,
      },
      chapters: (chapters || []).map((c) => ({ id: c.id, status: c.status })),
    });
  } catch (error) {
    console.error('GET /studio/:bookId/status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### 2. Frontend API helper
**File:** `client/src/services/api.js`  
Add before `export default api;`:

```js
export function getBookStatus(bookId) {
  return api.get(`/api/studio/${bookId}/status`).then((res) => res.data);
}
```

### 3. Frontend: Sidebar status dots
**File:** `client/src/components/layout/Sidebar.jsx`  
**Location:** chapter list item render (lines 132–153)

Add a colored dot indicator before the chapter title span, driven by `ch.status`:

```jsx
const statusColor = {
  completed: 'bg-green-500',
  processing: 'bg-yellow-500 animate-pulse',
  failed: 'bg-red-500',
  pending: 'bg-gray-300',
}[ch.status] ?? 'bg-gray-300';
```

Insert as a `span` between the sequence number span and the title span (line 146–148):

```jsx
<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
<span className="truncate flex-1">{ch.title}</span>
```

### 4. Frontend: Polling loop in Dashboard
**File:** `client/src/pages/Dashboard.jsx`

#### 4a. Add state
After line 158 (`isLoadingBook`), add:
```js
const [bookStatus, setBookStatus] = React.useState(null);
const pollIntervalRef = React.useRef(null);
```

#### 4b. Import `getBookStatus`
Add to the import from `../services/api.js` (line 11):
```js
import { ..., getBookStatus } from '../services/api.js';
```

#### 4c. Start/stop polling effect
Add after the existing initialization `useEffect` (after line 229):

```js
// Poll for synthesis progress while the book is being processed
React.useEffect(() => {
  if (!book || book.status !== 'processing') return;

  pollIntervalRef.current = setInterval(async () => {
    try {
      const res = await getBookStatus(book.id);
      if (!res?.success) return;
      setBookStatus(res);
      // Merge chapter status updates into local chapters array
      setBook((b) => ({
        ...b,
        chapters: b.chapters.map((ch, i) => {
          const updated = res.chapters?.[i];
          return updated ? { ...ch, status: updated.status } : ch;
        }),
      }));
    } catch {
      // Transient network error — silently ignore; interval retries
    }
  }, 5000);

  return () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };
}, [book?.id, book?.status]);
```

**Note:** `book.status` is read from the initial `GET /:bookId` response. After the bulk synthesis route sets it to `'processing'`, the interval starts. When status becomes `'completed'` or `'failed'`, the interval is cleared automatically by the dependency array.

#### 4d. Render progress strip
Inside `studioContent` (line 499 area), before the tab content, add:

```jsx
{book?.status === 'processing' && (
  <div className="mb-4 rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
    Processing Audio: {bookStatus?.book?.completed_chapters ?? book?.completed_chapters ?? 0} of{' '}
    {bookStatus?.book?.total_chapters ?? book?.total_chapters ?? book?.chapters?.length ?? 0} chapters done
  </div>
)}
```

Use `bookStatus?.book` when available (poll has run), falling back to the initial `book` object.

---

## Failure modes & rollback
- **Poll request fails** → silently ignored; interval retries on next tick.
- **`bookStatus` never resolves** → progress strip falls back to `book.completed_chapters` from initial load (may show 0 until first poll).
- **Sidebar dot shows stale color** → only visible during active generation window; user refreshes to get clean state.
- **`getBookStatus` missing from `api.js`** → explicit import is added; if forgotten, import error halts module load.

## Validation
1. Create/upload a book → navigate to Dashboard.
2. Trigger bulk synthesis (`generateAll()`).
3. Observe: status strip appears showing "Processing Audio: X of Y chapters done".
4. Wait for first poll (~5s) → confirm strip updates with new X value.
5. Check sidebar: chapters should show colored dots (yellow while processing, green as they complete).
6. After synthesis completes → strip disappears, all dots turn green, `bookStatus.book.status === 'completed'`.
7. Verify `GET /:bookId/status` returns BOLA-guarded data (404 for another user's book).

## Out of scope
- WebSocket push (deferred per project decision)
- Per-chapter retry UI
- Cancellation of in-flight synthesis jobs
- Animations beyond Tailwind `animate-pulse` on the yellow dot
