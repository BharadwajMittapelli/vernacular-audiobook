# Fix: Studio Export Does Not Appear in Downloads

## Root Cause
`Dashboard.jsx` `handleExport()` (line 438-472) downloads chapter transcript + audio but never calls `logExport()`. The BookCard.jsx full-book export already logs correctly (lines 43-52).

## Additional Gaps Discovered During Audit

### Schema gaps
The `downloads` table (migration 009) has NO `export_type` or `book_chapter_id` columns. Without these:
- Chapter exports and full-book exports are indistinguishable
- "Open" on a chapter export would incorrectly download the entire book via `exportBookMp3()`
- UI cannot show "Chapter Export" vs "Complete Audiobook Package"

### Verified facts
| Item | Finding |
|------|---------|
| Chapter ID type | `uuid` (from `005_create_chapters_table.sql` line 7) |
| `getChapterAudio()` response | `{ success, audioUrl, durationSeconds, alignment }` (from `audioRoutes.js:51-56`) |
| `getChapterAudio()` client call | `api.get(...).then(res => res.data)` → returns `{ audioUrl, ... }` (api.js:87) |
| `logExport()` contract | Pass-through POST — accepts any shape (api.js:156-158) |
| `handleDownloadAgain` | Currently takes `(bookId)`, always calls `exportBookMp3(bookId)` (AudioLibrary.jsx:81-99) |
| `currentBookIdRef.current` | Holds book UUID, set at Dashboard.jsx:176 |
| `chapter.chapterId` | Chapter UUID, used at Dashboard.jsx:451 |
| `book?.title` / `book?.coverUrl` | Available from book state set at Dashboard.jsx:218-222 |
| Backend auth | `authMiddleware` on `/api/library/*` (index.js:107), `req.user.id` available |
| RLS | Already enables user-scoped access (migration 009) |

## File-by-File Changes

### 1. `server/migrations/010_add_export_type_to_downloads.sql` — NEW
```sql
ALTER TABLE public.downloads
  ADD COLUMN IF NOT EXISTS export_type TEXT NOT NULL DEFAULT 'full_book',
  ADD COLUMN IF NOT EXISTS book_chapter_id UUID NULL;
```
- `export_type` defaults to `'full_book'` — existing records auto-classified correctly
- `book_chapter_id` is nullable UUID, NULL for full-book exports
- No index needed (not queried independently)

### 2. `server/src/routes/libraryRoutes.js` — MODIFY

**GET `/downloads`** (line 88-101): Add `export_type` and `book_chapter_id` to select, map to camelCase in response.

```javascript
// Before (line 90-93):
.select(`
  id, user_id, book_id, book_title, book_cover_url,
  file_name, file_format, file_size_bytes, exported_at,
  books!inner (total_chapters)
`)

// After:
.select(`
  id, user_id, book_id, book_chapter_id, book_title, book_cover_url,
  file_name, file_format, file_size_bytes, exported_at, export_type,
  books!inner (total_chapters)
`)
```

```javascript
// Before (line 98-101):
const downloads = (data || []).map((d) => ({
  ...d,
  totalChapters: d.books?.total_chapters ?? null,
}));

// After:
const downloads = (data || [])
  .filter((d) => d.export_type !== 'chapter' || d.book_chapter_id !== null)
  .map((d) => ({
    id: d.id,
    bookId: d.book_id,
    bookChapterId: d.book_chapter_id,
    bookTitle: d.book_title,
    bookCoverUrl: d.book_cover_url,
    fileName: d.file_name,
    fileFormat: d.file_format,
    fileSize: d.file_size_bytes,
    exportedAt: d.exported_at,
    exportType: d.export_type,
    totalChapters: d.books?.total_chapters ?? null,
  }));
```

Wait — the `.filter()` is wrong. Let me reconsider. The `export_type` column is new, so existing records won't have it. But the DEFAULT is `'full_book'`, so all existing records will get `'full_book'` automatically. No filter needed.

Actually, looking more carefully: the `.select()` with `books!inner` means only records with matching books are returned. If a book was deleted, the download record is CASCADE-deleted too. So no orphan records exist.

Revised GET response mapping (just add the two new fields):
```javascript
const downloads = (data || []).map((d) => ({
  ...d,
  totalChapters: d.books?.total_chapters ?? null,
  exportType: d.export_type,
  bookChapterId: d.book_chapter_id,
}));
```

**POST `/downloads/log`** (line 115, 122-130): Add `export_type` and `book_chapter_id` to validation and insert.

```javascript
// Line 115 — add to destructuring:
const { bookId, bookTitle, bookCoverUrl, fileName, fileFormat, fileSize, exportType, bookChapterId } = req.body;

// Validate exportType:
const validExportTypes = ['full_book', 'chapter'];
if (!validExportTypes.includes(exportType)) {
  return res.status(400).json({ success: false, error: 'Invalid exportType' });
}

// For chapter exports, validate bookChapterId is present:
if (exportType === 'chapter' && !bookChapterId) {
  return res.status(400).json({ success: false, error: 'bookChapterId required for chapter exports' });
}

// Line 122-130 — add to insert:
.insert([{
  user_id: userId,
  book_id: bookId,
  book_title: bookTitle,
  book_cover_url: bookCoverUrl || null,
  file_name: fileName,
  file_format: fileFormat || 'mp3',
  file_size_bytes: fileSize || null,
  export_type: exportType || 'full_book',
  book_chapter_id: bookChapterId || null,
}])
```

**Ownership validation for chapter exports**: The backend should verify the chapter belongs to the book. Add this check in POST:
```javascript
if (exportType === 'chapter') {
  const { error: chapterCheck } = await supabase
    .from('chapters')
    .select('id')
    .eq('id', bookChapterId)
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .single();
  if (chapterCheck || !chapterCheck) {
    return res.status(403).json({ success: false, error: 'Chapter does not belong to this book' });
  }
}
```

Wait, that logic is wrong. Let me fix:
```javascript
if (exportType === 'chapter') {
  const { data: chapterExists, error: chapterCheck } = await supabase
    .from('chapters')
    .select('id')
    .eq('id', bookChapterId)
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .single();
  if (chapterCheck || !chapterExists) {
    return res.status(403).json({ success: false, error: 'Chapter does not belong to this book' });
  }
}
```

### 3. `client/src/pages/Dashboard.jsx` — MODIFY (2 changes)

**a. Import `logExport`** (line 11):
```diff
- import { synthesizeAudio, synthesizeAsync, getChapterAudio, getChapterDetails, getBookDetails, getBookStatus, spatialPreview } from '../services/api.js';
+ import { synthesizeAudio, synthesizeAsync, getChapterAudio, getChapterDetails, getBookDetails, getBookStatus, spatialPreview, logExport } from '../services/api.js';
```

**b. Add logging after successful audio download** (after line 466, before the closing `} catch`):
```diff
       // ponytail: 2000ms revoke delay so large binaries aren't cancelled mid-transfer
       downloadBlob(blob, `${safe}.${ext}`, 2000);
+      // Log export to history (non-blocking, fire-and-forget)
+      logExport({
+        bookId: currentBookIdRef.current,
+        bookTitle: book?.title || 'Untitled Book',
+        bookCoverUrl: book?.coverUrl,
+        fileName: `${safe}.${ext}`,
+        fileFormat: ext,
+        fileSize: blob.size,
+        exportType: 'chapter',
+        bookChapterId: chapter?.chapterId,
+      }).catch((err) => console.error('[Dashboard] Failed to log export:', err));
     } catch (err) {
```

### 4. `client/src/components/audioLibrary/DownloadsView.jsx` — MODIFY (4 changes)

**a. Empty state message** (line 170):
```diff
- Export a book from My Books to see it here.
+ Export a book from My Books or Studio to see it here.
```

**b. PackageRow subtitle** (line 89) — dynamic label:
```diff
- <p className="text-xs text-muted-foreground mt-0.5">Complete Audiobook Package</p>
+ <p className="text-xs text-muted-foreground mt-0.5">
+   {item.exportType === 'chapter' ? 'Chapter Export' : 'Complete Audiobook Package'}
+ </p>
```

**c. DetailPanel subtitle** (line 238) — same dynamic label:
```diff
- <p className="text-xs text-muted-foreground mt-1">Complete Audiobook Package</p>
+ <p className="text-xs text-muted-foreground mt-1">
+   {item.exportType === 'chapter' ? 'Chapter Export' : 'Complete Audiobook Package'}
+ </p>
```

**d. Add chapter filename as tooltip/subtitle** in PackageRow after the format badge (around line 90-101):
After the format badge and before the date, if `item.exportType === 'chapter'` and `item.fileName`, show the chapter filename:
```jsx
{item.exportType === 'chapter' && item.fileName && (
  <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={item.fileName}>
    {item.fileName}
  </span>
)}
```

### 5. `client/src/pages/AudioLibrary.jsx` — MODIFY (2 changes)

**a. Update `handleDownloadAgain`** to accept the full download item and route by export type:
```javascript
// Before (line 81-99):
const handleDownloadAgain = useCallback(async (bookId) => {
  try {
    const res = await exportBookMp3(bookId);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    const contentDisp = res.headers['content-disposition'] || '';
    const match = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^"';\s]+)['"]?/);
    const filename = match ? decodeURIComponent(match[1]) : 'audiobook.mp3';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('[AudioLibrary] Download again failed:', err);
    throw err;
  }
}, []);

// After:
const handleDownloadAgain = useCallback(async (item) => {
  try {
    if (item.exportType === 'chapter' && item.bookChapterId) {
      // Chapter export: re-download using chapter audio API
      const audioData = await getChapterAudio(item.bookChapterId);
      if (!audioData?.audioUrl) throw new Error('No audio URL available');
      const res = await fetch(audioData.audioUrl);
      if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
      const blob = await res.blob();
      if (blob.type && !blob.type.startsWith('audio/')) {
        throw new Error('Unexpected content type');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName || 'chapter.mp3';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else {
      // Full-book export: use existing merged MP3 endpoint
      const res = await exportBookMp3(item.bookId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const contentDisp = res.headers['content-disposition'] || '';
      const match = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^"';\s]+)['"]?/);
      const filename = match ? decodeURIComponent(match[1]) : 'audiobook.mp3';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  } catch (err) {
    console.error('[AudioLibrary] Download again failed:', err);
    throw err;
  }
}, []);
```

**b. Update `DownloadsView` call** (line 264):
```diff
- <DownloadsView onDownloadAgain={handleDownloadAgain} />
+ <DownloadsView onDownloadAgain={handleDownloadAgain} />
```
No change needed — `handleDownloadAgain` now accepts an `item` object instead of `bookId`, and `DownloadsView` already passes the full `item` via `onOpen(item)`.

### 6. `client/src/services/api.js` — NO CHANGE NEEDED
`logExport(download)` already passes through the full request body. `getChapterAudio()` already exists and returns `{ audioUrl }`.

## Summary of Changes

| File | Lines Changed | Type |
|------|-------------|------|
| `server/migrations/010_add_export_type_to_downloads.sql` | NEW | Migration |
| `server/src/routes/libraryRoutes.js` | ~15 | Modify GET/POST |
| `client/src/pages/Dashboard.jsx` | 2 | Import + log call |
| `client/src/components/audioLibrary/DownloadsView.jsx` | 4 | Labels + metadata |
| `client/src/pages/AudioLibrary.jsx` | ~25 | Update handleDownloadAgain |
| `client/src/services/api.js` | 0 | No change |

## Security
- `req.user.id` validated server-side for all endpoints (authMiddleware already in place)
- Chapter ownership verified: `chapters.book_id = bookId AND chapters.user_id = userId`
- RLS policies enforce user isolation
- `export_type` validated against whitelist `['full_book', 'chapter']`
- Existing records unaffected (DEFAULT `'full_book'`)

## Testing
1. Export from Studio → verify `export_type='chapter'` record created
2. Export from My Books → verify `export_type='full_book'` record still works
3. Downloads tab → chapter shows "Chapter Export", full-book shows "Complete Audiobook Package"
4. Open chapter export → downloads chapter audio only (not full book)
5. Open full-book export → downloads full merged MP3 (existing behavior)
6. Refresh → records persist
7. Remove → only history deleted
8. Build passes
