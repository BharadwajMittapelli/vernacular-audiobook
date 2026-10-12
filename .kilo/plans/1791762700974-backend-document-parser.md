# Dev B + Dev A — Backend Document Parser (PDF/EPUB server-side extraction)

**Branch:** `master` · **Scope:** `/server` (primary) + `/client` (wiring) · Backend `http://localhost:4001`.
**Goal:** users upload `.pdf`/`.epub` through the studio dropzone; server extracts UTF-8 text, splits into chapters, returns the same `{ title, chapters:[{chapterId,title,text}] }` shape the client already handles. Phase 1/2 client work stays intact.

## Verified context (do not re-litigate)
- Server is ESM (`"type": "module"`), routes mounted in `server/src/index.js`; `express.json({ limit: '1mb' })` runs app-wide but **skips multipart**, so it does not break the upload. `apiLimiter` (5/min) applies to `/api/documents` unless skipped — fine for v1.
- Auth is a stub (`middleware/auth.js` hardcodes user). Task says **no** auth on `/api/documents` — follow spec (parse is free, no credits/DB touched). Note for later: real JWT → gate uploads too.
- `POST /api/audio/synthesize-async` already creates the `books` row. **Document upload stays stateless** — parse and return text only; no DB write, no file persistence.
- `server/src/utils/` does not exist → create it. Precedent self-check file: `server/src/services/audioStitcher.selfcheck.mjs`.
- Client contract already matches: `App.jsx` `handleDocumentLoaded({ title, chapters })` uses `ch.chapterId` → server IDs feed synthesis unchanged. `.txt/.md` stay client-parsed (`splitChapters.js`); server util is only for PDF/EPUB.

## Critical risk — pdf-parse × ESM (the 3am page)
`pdf-parse@1.x` internally uses `__dirname` for its data file; under `"type": "module"` that is undefined → `ENOENT` on import/call. **Required workaround:** load it through CommonJS, not `import`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
```
`adm-zip` imports normally in ESM (`import AdmZip from 'adm-zip'`). If `npm i` resolves a different `pdf-parse` major with a named/class export, adapt the call there (one line) — verify the export shape before writing the handler.

## Server tasks
1. **Deps** — `cd server; npm install multer pdf-parse adm-zip`.
2. **`server/src/utils/chapterSplitter.js` (new)** — `export function splitTextIntoChapters(text, filename)`:
   - Header split via `/\n(?=Chapter\s+\d+|CHAPTER\s+\d+|#{1,6}\s)/i` (headers stay with their body); title = first line trimmed, `#`/`**` stripped, fallback `Chapter N`; text before first header kept as `Front Matter` only if meaningful (> ~100 chars).
   - No headers → 5,000-char chunks broken at the last `\n\n` (hard slice if none).
   - Each: `{ chapterId: crypto.randomUUID(), title, text }`.
   - This mirrors `client/src/services/chapterSplitter.js` logic; keep it a standalone util (two consumers: route + self-check).
3. **`server/src/routes/documentRoutes.js` (new)** — `POST /upload`, `multer({ storage: multer.memoryStorage(), limits: { fileSize: 20*1024*1024 } }).single('file')`:
   - No file → 400; multer `LIMIT_FILE_SIZE` → 413; non pdf/epub ext → 400.
   - `.pdf`: `const { text } = await pdfParse(req.file.buffer)` (dataBuffer is a `Buffer`, which multer memory gives; pdf-parse's default pagerender returns raw text — good enough).
   - `.epub`: `new AdmZip(req.file.buffer)`, keep entries ending `.xhtml`/`.html` (skip `.opf`/`.ncx`/`.css`/images), sort by entryName (ponytail: filename order approximates spine order; proper OPF-spine read only if clients report scrambling), `readAsText(entry)`, strip `<script>`/`<style>` then tags via `/<[^>]+>/g`, decode `&nbsp; &amp; &lt; &gt; &#\d+;`, join entries with `\n\n`.
   - Ensure UTF-8: parse from Buffers explicitly and strip a leading `\uFEFF` BOM; feed raw text to `splitTextIntoChapters`.
   - No chapters → 422 `{ success:false, error:'No readable text found' }`. Success → `{ success:true, title: <filename sans ext>, chapters }`. Wrap handler in try/catch → 500.
4. **`server/src/index.js`** — `import documentRouter from './routes/documentRoutes.js'` + `app.use('/api/documents', documentRouter)`.
5. **`server/src/utils/chapterSplitter.selfcheck.mjs` (new)** — follow the existing self-check style: assert header split (Chapter/CHAPTER/#), short front-matter drop, no-header fallback length, id presence. `node server/src/utils/chapterSplitter.selfcheck.mjs`.

## Client tasks
6. **`client/src/services/api.js`** — `uploadDocument(file)` builds `FormData` (`form.append('file', file)`), `api.post('/api/documents/upload', form).then(res => res.data)`. (Return `.data`, not the axios response — matches the client's `onDocumentLoaded(res.data)` wiring; all other helpers return parsed bodies.)
7. **`client/src/components/studio/BookUploader.jsx`** — replace the pdf/epub notice branch with an async `uploadDocument(file)` call; on success `onDocumentLoaded(result)`; on failure map `err.response?.data?.error || 'Upload failed'` into the existing `msg` error state. `.txt/.md` branch unchanged. Update helper copy to ".txt and .md parse in-browser · .pdf and .epub on the server"; keep 20MB cap.

## Validation
- Server: `node --check` on `index.js`, `documentRoutes.js`, `chapterSplitter.js`; run the self-check; boot `npm run dev`; `curl -F "file=@sample.pdf" http://localhost:4001/api/documents/upload` and same for an `.epub` → expect `{ success, title, chapters[] }`.
- Client: `cd client; npm run build` (vite is the syntax gate).
- E2E (backend up): drop a `.pdf` → chapters appear in selector → single Generate + Generate All queue (202) with server-minted chapterIds → `GET /api/audio/:chapterId` hydration works.

## Decisions & notes
- `crypto.randomUUID()` per the task spec (server Node 14.17+ has it); swap for `uuidv4` if a reviewer wants codebase consistency.
- **multer is redundant** (v1's 1 MB `express.json` cap already blocks >1 MB JSON bodies; a ~10-line Buffer hander would do). Included because the directive mandates `multer.single('file')` and it gives the 20 MB multipart guard cleanly. Revisit if dependency surface is tightened.
- `adm-zip` is deprecated upstream; acceptable for the stated lightweight mandate — swap to `yauzl`/`jszip` only if a real EPUB fails to open.

## Out of scope
- Persisting uploaded books, progress polling, EPUB TOC/cover extraction, auth/JWT gating, OCR/scanned-PDF text recovery (pdf-parse returns empty for image-only PDFs → 422).
