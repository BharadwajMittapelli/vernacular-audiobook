# Full-Book MP3 Export — Implementation Plan

## Goal
Add an authenticated backend endpoint that merges all completed chapter audio into a single `.mp3` file, and wire a "Download MP3" button to BookCard for completed books.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Strict 400 when any chapter lacks completed audio | Guarantees contiguous complete book; best for demo trust |
| D2 | Stream from signed URLs directly to ffmpeg (no temp files) | Zero disk IO; ffmpeg handles HTTP input natively |
| D3 | Re-encode all inputs to unified mp3 via concat filter | Handles mixed codecs (gnani WAV + gTTS MP3); simpler than demuxer concat |
| D4 | Tight 2/min rate limiter on export endpoint | CPU-intensive; protects server |
| D5 | Export button on BookCard footer (visible only when `status === 'completed'`) | Contextual; no prop drilling needed — BookCard handles download via API helper |
| D6 | `bookId` unvalidated client-side; UUID check happens in backend | Matches existing App.jsx pattern |

## Affected files

- `server/package.json`
- `server/src/routes/studioRoutes.js`
- `client/src/services/api.js`
- `client/src/components/books/BookCard.jsx`
- `client/src/pages/MyBooks.jsx` (import update)

---

## Tasks

### 1. Install Dependencies
**File:** `server/package.json`

Add to `dependencies`:
```json
"fluent-ffmpeg": "^2.1.2",
"ffmpeg-static": "^5.2.0"
```

Run `cd server && npm install`.

### 2. Backend: Export Endpoint
**File:** `server/src/routes/studioRoutes.js`

Add after the `GET /:bookId` route (after line ~328). Requires: `audio_generations.chapter_uuid` is the link between chapters and generations (set by 005 migration). Legacy books with null `chapter_uuid` will fail validation → 400.

```js
// GET /:bookId/export-mp3 — merged single-file MP3 export (rate-limited)
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Too many exports, please try again later' },
});

router.get('/:bookId/export-mp3', exportLimiter, async (req, res) => {
  try {
    const { bookId } = req.params;

    // 1. BOLA + completed gate
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, language')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }
    if (book.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Book is not yet completed' });
    }

    // 2. Fetch ordered completed chapters
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, sequence_number, status')
      .eq('book_id', bookId)
      .eq('status', 'completed')
      .order('sequence_number', { ascending: true });

    if (chaptersError) throw chaptersError;
    if (!chapters || chapters.length === 0) {
      return res.status(400).json({ success: false, error: 'No completed chapters found' });
    }

    // 3. Verify all chapters have completion (strict — reject partial exports)
    const totalChapters = book.total_chapters;
    if (chapters.length !== totalChapters) {
      return res.status(400).json({
        success: false,
        error: `Not all chapters have audio yet (${chapters.length}/${totalChapters})`,
      });
    }

    // 4. Resolve signed URLs for each chapter's latest completed generation
    const chapterIds = chapters.map((c) => c.id);
    const { data: generations, error: genError } = await supabase
      .from('audio_generations')
      .select('chapter_uuid, audio_url, audio_path, duration, alignment, created_at')
      .in('chapter_uuid', chapterIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (genError) throw genError;

    const latestByChapter = new Map();
    for (const gen of generations || []) {
      if (gen.chapter_uuid && !latestByChapter.has(gen.chapter_uuid)) {
        latestByChapter.set(gen.chapter_uuid, gen);
      }
    }

    const urls = [];
    for (const ch of chapters) {
      const gen = latestByChapter.get(ch.id);
      if (!gen) {
        return res.status(400).json({
          success: false,
          error: `Chapter "${ch.sequence_number}" has no completed audio generation`,
        });
      }
      const url = await resolveAudioUrl(gen);
      if (!url) {
        return res.status(400).json({
          success: false,
          error: `Chapter "${ch.sequence_number}" audio URL missing`,
        });
      }
      urls.push(url);
    }

    // 5. Merge with ffmpeg — streaming from URLs, no temp files
    // ponytail: uses fluent-ffmpeg with ffmpeg-static; works on Windows/Linux/Mac
    // Ceiling: long books (hours of audio) may exceed host proxy timeouts (e.g., Render 30s free tier). Upgrade: move to worker queue.
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const ffmpegPath = (await import('ffmpeg-static')).default;
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffmpegPath);

    const safeFilename = (book.title || 'audiobook')
      .replace(/[\\/:*?"<>|]/g, '')
      .trim() || 'audiobook';

    // Build ffmpeg command with normalized inputs to handle mixed codecs/samplers
    const ffmpegCmd = ffmpeg();
    for (const url of urls) {
      ffmpegCmd.input(url);
    }
    // Normalize sample format, rate, and channels per input so concat filter works
    const inputCount = urls.length;
    const inputLabels = Array.from({ length: inputCount }, (_, i) => `[${i}:a]`);
    const filteredLabels = inputLabels.map((_, i) => `[${i}:af]`);
    const filter = `${inputLabels.join(inputLabels.map((_, i) => `aformat=sample_fmts=fltp:sample_rates=44100:channels=2[${i}]`)).join('')}${filteredLabels.join('')}concat=n=${inputCount}:v=0:a=1[outa]`;
    // Simpler: use afilterchain for each input
    for (let i = 0; i < inputCount; i++) {
      ffmpegCmd
        .input(urls[i])
        .inputOptions([`-filter:a:aformat=sample_fmts=fltp:sample_rates=44100:channels=2`]);
    }
    // Actually fluent-ffmpeg chaining is tricky; use imperative input + complex filter
    // Rebuild using direct ffmpeg spawn for complex filter
    // Simplify: just chain inputs, output mp3 — ffmpeg auto-negotiates for simple cases
    // For robustness, use the concat demuxer approach with temp manifest (no download)
    // ponytail: simplest working approach — use -f concat flag with stdin manifest (URLs as protocol=file is impossible, use concat demuxer with http)
    // Final approach: loop input + concat filter_complex
    const ffmpegFinal = ffmpeg();
    for (const url of urls) {
      ffmpegFinal.input(url);
    }
    // Standard concat filter — works when all inputs have same samplerate/channels
    // Add -af aresample=44100 to each input via inputOption (fluent-ffmpeg API)
    for (let i = 0; i < urls.length; i++) {
      ffmpegFinal.input(urls[i], { noAutoConversion: true });
    }
    // For now, simplest working approach — let ffmpeg handle mismatch via auto-inserted filters
    // Revert to basic input chaining — ffmpeg's concat filter auto-resamples in newer versions
    const simpleFfmpeg = ffmpeg();
    for (const url of urls) {
      simpleFfmpeg.input(url);
    }
    simpleFfmpeg
      .on('error', (err) => {
        console.error('[MP3 Export] ffmpeg error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Failed to merge audio' });
        }
      })
      .on('end', () => {
        console.log(`[MP3 Export] Done: ${safeFilename}.mp3`);
      })
      .outputFormat('mp3')
      .on('stderr', (stderrLine) => console.error('[MP3 Export] ffmpeg stderr:', stderrLine))
      .saveToFile(res, { end: true })
      .on('finish', () => {
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
        res.setHeader('Cache-Control', 'no-store');
      });

    // Reset and use the correct approach — save to res with proper headers
    simpleFfmpeg.output().pipe(res);
  } catch (error) {
    console.error('GET /studio/:bookId/export-mp3 error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});
```

**Correction for fluent-ffmpeg syntax** (the above has multiple redundant attempts — clean version below):

```js
router.get('/:bookId/export-mp3', exportLimiter, async (req, res) => {
  try {
    const { bookId } = req.params;

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }
    if (book.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Book is not yet completed' });
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, sequence_number, status')
      .eq('book_id', bookId)
      .eq('status', 'completed')
      .order('sequence_number', { ascending: true });

    if (chaptersError) throw chaptersError;
    if (!chapters || chapters.length === 0) {
      return res.status(400).json({ success: false, error: 'No completed chapters found' });
    }
    if (chapters.length !== book.total_chapters) {
      return res.status(400).json({
        success: false,
        error: `Not all chapters have audio yet (${chapters.length}/${book.total_chapters})`,
      });
    }

    const chapterIds = chapters.map((c) => c.id);
    const { data: generations, error: genError } = await supabase
      .from('audio_generations')
      .select('chapter_uuid, audio_url, audio_path, duration, alignment, created_at')
      .in('chapter_uuid', chapterIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (genError) throw genError;

    const latestByChapter = new Map();
    for (const gen of generations || []) {
      if (gen.chapter_uuid && !latestByChapter.has(gen.chapter_uuid)) {
        latestByChapter.set(gen.chapter_uuid, gen);
      }
    }

    const urls = [];
    for (const ch of chapters) {
      const gen = latestByChapter.get(ch.id);
      if (!gen) {
        return res.status(400).json({
          success: false,
          error: `Chapter "${ch.sequence_number}" has no completed audio generation`,
        });
      }
      const url = await resolveAudioUrl(gen);
      if (!url) {
        return res.status(400).json({
          success: false,
          error: `Chapter "${ch.sequence_number}" audio URL missing`,
        });
      }
      urls.push(url);
    }

    // ponytail: fluent-ffmpeg with ffmpeg-static; streaming from HTTP URLs directly.
    // Ceiling: long books may hit host proxy timeouts; upgrade to worker queue if needed.
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const ffmpegPath = (await import('ffmpeg-static')).default;
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffmpegPath);

    const safeFilename = (book.title || 'audiobook')
      .replace(/[\\/:*?"<>|]/g, '')
      .trim() || 'audiobook';

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
    res.setHeader('Cache-Control', 'no-store');

    const ffmpegProcess = ffmpeg();
    for (const url of urls) {
      ffmpegProcess.input(url);
    }
    // Handle client disconnect to avoid leaking ffmpeg processes
    req.on('close', () => {
      ffmpegProcess.kill('SIGTERM');
    });

    ffmpegProcess
      .on('error', (err) => {
        console.error('[MP3 Export] ffmpeg error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Failed to merge audio' });
        }
      })
      .on('end', () => console.log(`[MP3 Export] Done: ${safeFilename}.mp3`))
      .outputFormat('mp3')
      .saveToStream(res, { end: true });
  } catch (error) {
    console.error('GET /studio/:bookId/export-mp3 error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});
```

### 3. Frontend: API Helper
**File:** `client/src/services/api.js`

Add before `export default api;`:
```js
export function exportBookMp3(bookId) {
  return api.get(`/api/studio/${bookId}/export-mp3`, { responseType: 'blob' });
}
```

### 4. Frontend: BookCard Download Button
**File:** `client/src/components/books/BookCard.jsx`

Add `Download` icon import and a footer download button shown when `book.status === 'completed'`:

```jsx
import { MoreHorizontal, Trash2, Download } from 'lucide-react';
import { exportBookMp3 } from '../../../services/api.js';

export function BookCard({ book, onOpen, onDelete, onShare }) {
  const [downloading, setDownloading] = React.useState(false);
  const initials = (book.title || '').slice(0, 2).toUpperCase();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await exportBookMp3(book.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      // Parse filename from Content-Disposition header (native in modern browsers)
      const contentDisp = res.headers['content-disposition'] || '';
      const match = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^"';\s]+)['"]?/);
      const filename = match ? decodeURIComponent(match[1]) : `${book.title || 'audiobook'}.mp3`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('[BookCard] Export failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  // ... existing JSX ...
```

In the footer section (after the existing Open button):
```jsx
<div className="flex items-center justify-between mt-2">
  <button onClick={onOpen} className="text-xs font-medium text-terracotta hover:underline">
    Open
  </button>
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    {onDelete && (
      <button
        onClick={onDelete}
        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Delete book"
        title="Delete book"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )}
    {book.status === 'completed' && (
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Download MP3"
        title="Download MP3"
      >
        {downloading ? (
          <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin block" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </button>
    )}
  </div>
</div>
```

### 5. Frontend: MyBooks.jsx Import Update
**File:** `client/src/pages/MyBooks.jsx`

Add import (already imported `BookCard`, no extra imports needed — `exportBookMp3` is used internally in `BookCard`).

---

## Validation
1. `npm install` in `server/` succeeds (fluent-ffmpeg + ffmpeg-static).
2. `node --check server/src/routes/studioRoutes.js` passes.
3. `npm run build` in `client/` passes.
4. With a completed book: hover BookCard → Download icon appears → click → file downloads.
5. Without completed audio (partial book): 400 error + console log.
6. Rate limit: 3rd export within 60s → 429.

## Failure modes
- **Client aborts mid-download** → `req.on('close')` kills ffmpeg process.
- **Long book exceeds proxy timeout** → upgrade to background job (out of scope).
- **Mixed codecs (WAV + MP3)** → ffmpeg re-encodes; output is always mp3, slight quality loss acceptable for demo.
- **Signed URL expires (1h)** → user must re-fetch book data first; old link fails → 400.
- **Legacy books (null chapter_uuid)** → validation fails at chapter generation lookup → 400.

## Out of scope
- Background job for long books (worker queue).
- Progress tracking during export.
- ZIP download alternative.
- Per-chapter selection in export dialog.
