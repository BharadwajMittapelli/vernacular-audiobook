# Plan: DOCX Parser Support & JSON Payload Limit

**Scope:** `/server` only (`package.json`, `src/index.js`, `src/routes/documentRoutes.js`)  
**Goal:** Fix `413 Payload Too Large` on `POST /api/studio` ingestion and add `.docx` extraction to the document parser.

---

## Context (verified)
- `server/src/index.js:43` — `app.use(express.json({ limit: '1mb' }));` is the cause of the 413 on large book payloads. Needs `50mb`.
- `server/src/routes/documentRoutes.js` accepts only `.pdf`/`.epub` (line 70-73), extracts via `pdfText()`/`epubText()`, then runs `splitTextIntoChapters(raw)` and returns `{ success, title, chapters }` where each chapter is `{ chapterId, title, text }`.
- `mammoth` is NOT in `server/package.json` dependencies.
- multer upload cap stays at 20 MB file size — unchanged.
- The JSON limit applies app-wide (all routes), not just `/api/studio`. Accept the wider DoS surface for now; the API rate limiter (5 req/min) already caps exposure.

---

## Tasks

### 1. Install mammoth
```
npm install mammoth
```
Run in `server/` directory.

### 2. Payload limit patch — `server/src/index.js:43`
```js
app.use(express.json({ limit: '50mb' }));
```
One-line change.

### 3. DOCX support — `server/src/routes/documentRoutes.js`

**a. Import at top (after line 4):**
```js
import mammoth from 'mammoth';
```

**b. Extraction helper (next to `pdfText`):**
```js
async function docxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
```

**c. Accept `.docx` in validation (line 70-73).** Replace the extension gate:
```js
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const isDocx = ext === 'docx' || req.file.mimetype === DOCX_MIME;
if (ext !== 'pdf' && ext !== 'epub' && !isDocx) {
  return res.status(400).json({ success: false, error: 'Only .pdf, .epub, and .docx are supported on this endpoint' });
}
```

**d. Route to extractor (line 75):**
```js
const raw = ext === 'pdf' ? await pdfText(req.file.buffer) : isDocx ? await docxText(req.file.buffer) : epubText(req.file.buffer);
```
`splitTextIntoChapters()` and the response shape stay untouched — DOCX output flows through the identical stateless pipeline.

---

## Decisions
- **Extension OR MIME check:** a renamed file with the real DOCX mimetype still parses; a mislabeled file falls through to the 400 or fails in mammoth (caught by the existing handler catch → 500). Both acceptable.
- **`extractRawText` only:** drops formatting/images by design; chapter splitting is header/blank-line based, raw text is sufficient.
- **No legacy `.doc` support:** binary format, needs native tooling. Out of scope — the 400 message lists only the three supported formats.

## Failure modes
- Corrupt/docx-with-macro → mammoth throws → existing catch returns 500 with `error.message`.
- Empty docx → `extractRawText` returns `""` → `splitTextIntoChapters` returns `[]` → existing 422 `No readable text found`.

---

## Validation
1. `node --check server/src/index.js && node --check server/src/routes/documentRoutes.js`
2. Smoke test with a real `.docx`:
```
curl -X POST http://localhost:4001/api/documents/upload -H "Authorization: Bearer <token>" -F "file=@sample.docx"
```
Expect 200 with `{ success: true, title, chapters: [...] }`.
3. Rejected type (`.txt` upload) still returns 400 listing pdf/epub/docx.
4. Regression: existing `.pdf` upload still returns 200.

## Files to change
- `server/package.json` (+ `package-lock.json`) — mammoth dependency
- `server/src/index.js` — json limit 1mb → 50mb
- `server/src/routes/documentRoutes.js` — mammoth import, `docxText()`, validation + extractor branch
