# Dev A Phase 2 — Document Upload & Chapter Parser (TXT/MD only)

**Branch:** `dev-client` · **Scope:** `/client` only · Backend at `http://localhost:4001`.
**Approved decision (Option 2):** TXT/MD parsed natively; PDF/EPUB are UI-only affordances that show "PDF & EPUB support requires server-side processing (Backend endpoint pending)." **No new dependencies** — `pdfjs-dist`, `jszip`, `epubjs`, `pako` are all banned.

Phase 1 (api.js axios layer, useAudioPlayer TDZ fix + `setPlaybackRate`, VoiceSelector, CreditEstimateBadge parity, TranscriptHighlighter click-to-seek) is DONE and merged into the working tree. Do not regress it.

## Decisions (settled)
- **PDF/EPUB:** accepted in the dropzone UI, never parsed. On drop → inline notice, file discarded. Server-side extraction endpoint is Dev B's future work; do not add upload plumbing for it.
- **Parsing:** `FileReader.readAsText(file)` for `.txt`/`.md` only. Reject files > 20 MB (`file.size`) to protect the tab.
- **Chapter splitting** (client-side, lives inside `BookUploader.jsx` — single consumer, no new util file):
  1. Header split: `/\n(?=Chapter\s+\d+|CHAPTER\s+\d+|#{1,6}\s)/` on the raw text. Text before the first header (if > 100 chars) becomes a `Front Matter` chapter.
  2. No headers found → slice every 5,000 chars at the last `\n\n` before the boundary (ponytail: plain boundary slice is enough; backend re-chunks to 400 chars per TTS call in `textProcessor.js` anyway).
  3. Chapter title: the matched header line (trimmed, `#` stripped); fallback `Chapter N`.
- **Emit contract (per task spec):** `onDocumentLoaded({ title, chapters: [{ chapterId, title, text }] })` where `chapterId = crypto.randomUUID()` and `title` (book) = filename without extension.
- **chapterId stability:** generated once at parse time, kept in App state — re-selecting a chapter must NOT mint new ids (idempotency + `GET /api/audio/:chapterId` lookup depend on it).
- **Bulk synthesis:** reuse existing `synthesizeAsync` (already injects per-chapter `Idempotency-Key`s). Backend pre-checks credits and returns **202** `{ success, bookId, totalChapters, queued, cached }` — not audio. So add one line to `api.js`: `getChapterAudio(chapterId)` → `GET /api/audio/:chapterId` → `{ audioUrl, durationSeconds, alignment }`; selecting a chapter calls it, shows existing audio if present, clears player if 404.
- **Credits:** keep `Math.ceil(stripMarkdown(text).trim().length / 100)` (badge already correct). Replace App.jsx:17-19 `calculateCredits` (missing `.trim()`) with per-active-chapter value from the same formula; total for bulk = sum over chapters.
- **VoiceSelector / ReadAlongPlayer / AudioConfigModal:** untouched props contracts. `handleGenerate({...,submit:true})` flow stays; only the payload source changes (`sample-chapter-1`/`DEFAULT_TEXT` → active chapter).

## Tasks
1. **`client/src/components/studio/BookUploader.jsx` (new)**
   - Dropzone: `<label>` wrapping a visually-hidden `<input type="file" accept=".txt,.md,.pdf,.epub">` + `onDragOver`/`onDragLeave`/`onDrop` styling (keyboard-accessible for free via label/input).
   - Extension routing: `.txt`/`.md` → `readAsText` → `splitChapters(text)` → `onDocumentLoaded`. `.pdf`/`.epub` → set `notice` state with the exact copy above. Anything else → "Unsupported file type".
   - `splitChapters(text)` implements the header-regex + 5,000-char fallback above; returns `[]` (with an error message) when the file yields no usable text.
   - Keep state minimal: `busy`, `error`, `notice`. No progress bars, no multi-file.
2. **`client/src/services/api.js`** — add `getChapterAudio(chapterId)` (one `api.get(...).then(res => res.data)`).
3. **`client/src/App.jsx`**
   - New state: `book = { title, chapters }` | null, `activeIdx = 0`, `bulkStatus` | null.
   - `book === null` → render `<BookUploader onDocumentLoaded={...}/>` in the main card (delete `DEFAULT_TEXT` and the hardcoded `sample-chapter-1` / Characters / Est. Credits rows it feeds).
   - Chapter selector: Shadcn `Select` (already installed via `@radix-ui/react-select`) listing chapters when `chapters.length > 1`; changing it sets `activeIdx`, clears `audioResult`/`error`, and calls `getChapterAudio(chapterId)` — populate `audioResult` on 200, null on 404.
   - `handleGenerate(submit)` posts `{ chapterId, text }` of the **active chapter** (rest unchanged; voice guard `disabled={...|| !selectedVoice}` stays).
   - "Generate All Chapters" button next to Generate → `synthesizeAsync({ chapters: book.chapters.map(ch => ({ chapterId: ch.chapterId, text: ch.text, language, voiceProfile, speed })) })` → show `bulkStatus` (`Queued ${queued}, cached ${cached}`) in the Audio Status panel; disable while in flight and when no voice selected; surface 402 `required/available` in the error box.
   - Header "Load New Book" button (`BookOpen`-adjacent): clears `book`, `audioResult`, `bulkStatus`, `error`, resets `activeIdx`.
   - `CreditEstimateBadge text={activeChapter.text}`; Audio Status "Credits Used" → active-chapter estimate; bulk button label shows total estimate across chapters.
4. **Validation**
   - `npm run build` in `client/` (no lint/typecheck scripts exist; `vite build` is the syntax gate).
   - Manual: drop a `.md` with `# ` headers → chapters detected; drop a headerless `.txt` > 5,000 chars → chunked; drop a `.pdf` → server-side notice, state unchanged; single-chapter generate → player works with click-to-seek; Generate All with 2 chapters → 224/202 status line, selecting the second chapter after queueing fetches its audio via `GET /api/audio/:chapterId`.
   - Sanity: backend on `:4001` currently down (verified earlier via `/api/voices` fetch failure) — static build + UI flows verifiable regardless; full round-trip once Dev B's server runs.

## Risks
- `crypto.randomUUID()` requires secure context (fine on `localhost`).
- Malformed files > few MB as one string: 20 MB cap guards the tab; splitting is regex over the whole string (fine at that size).
- Idempotency-key scope: async route prefixes keys with `bookId` server-side; minting chapter ids client-side and reusing them across regens is intended (server dedupes/replays on key).

## Out of scope
- Real PDF/EPUB extraction (server endpoint, Dev B), book persistence/library view, progress polling for bulk jobs, file size/credit hardening beyond the checks above.
