# Plan: POST / Book Ingestion Endpoint

**Scope:** `server/src/routes/studioRoutes.js` only  
**Goal:** Persist parsed document JSON (`title` + `chapters[]`) atomically into `books` + `chapters` tables.

---

## Current State
- `studioRoutes.js` has `GET /`, `GET /:bookId`, `GET /chapters/:chapterId`, `POST /chapters/:chapterId/synthesize`.
- `GET /:bookId` must remain intact; mount `POST /` above it to avoid any Express method-mismatch confusion (different HTTP methods, but ordering is explicit in the spec).
- `stripMarkdown` is already imported and used in `POST /chapters/:chapterId/synthesize`.
- `express.json()` middleware is active (index.js:43).
- Auth middleware gates the entire `/api/studio` prefix (index.js:89).

---

## Payload Shape
```json
{
  "title": "The Art of Reading",
  "chapters": [
    { "title": "Chapter 1", "text": "Raw text content..." },
    { "title": "Chapter 2", "text": "Raw text content..." }
  ]
}
```

This matches the stateless output of `POST /api/documents/upload` (documentRoutes.js:81-85).

---

## Implementation Steps

### 1. Insert the route before `GET /:bookId`
Add `router.post('/', ...)` immediately after the existing `GET /` handler (after line 27) and before `GET /:bookId` (line 29).

### 2. Validate the payload
- `req.body.title` — required, string, trimmed, non-empty. Return 400 if missing/empty.
- `req.body.chapters` — required, array, length >= 1. Return 400 if missing/not-array/empty.
- Each chapter item must have:
  - `title` — string, trimmed, non-empty. Return 400 if missing/empty.
  - `text` — string, trimmed, non-empty (after stripMarkdown). Return 400 if missing/empty.

### 3. Compute derived fields
- `cleanText = stripMarkdown(ch.text.trim())` — declared **once per chapter**, reused for both `text_content` and `char_count`.
- `char_count = cleanText.length`
- `estimated_duration_seconds = Math.ceil(cleanText.length / 15)` — rough reading-time heuristic required by frontend UI.
- `status = 'pending'`

### 4. Insert the book row
```js
const { data: book, error: bookError } = await supabase
  .from('books')
  .insert({
    user_id: req.user.id,
    title: title.trim(),
    total_chapters: chapters.length,
    completed_chapters: 0,
    status: 'pending',
  })
  .select('*')
  .single();
if (bookError || !book) throw bookError;
```

### 5. Insert all chapters in one batch
Build the chapters array first (cleanText declared once per item), then a single `.insert()`:
```js
const chaptersData = chapters.map((ch, i) => {
  const cleanText = stripMarkdown(ch.text.trim());
  if (!cleanText) return null;
  return {
    book_id: book.id,
    user_id: req.user.id,
    sequence_number: i + 1,
    title: ch.title.trim(),
    text_content: cleanText,
    char_count: cleanText.length,
    estimated_duration_seconds: Math.ceil(cleanText.length / 15),
    status: 'pending',
  };
}).filter(Boolean);

if (chaptersData.length === 0) {
  return res.status(400).json({ success: false, error: 'No valid chapters after text processing' });
}

const { error: chaptersError } = await supabase.from('chapters').insert(chaptersData);
if (chaptersError) {
  // Rollback: delete the partially-created book
  await supabase.from('books').delete().eq('id', book.id).eq('user_id', req.user.id);
  throw chaptersError;
}
```

### 6. Fetch and return the result
```js
const { data: insertedChapters } = await supabase
  .from('chapters')
  .select('id, sequence_number, title, char_count, estimated_duration_seconds, status')
  .eq('book_id', book.id)
  .order('sequence_number', { ascending: true });

res.json({
  success: true,
  book: { id: book.id, title: book.title, total_chapters: book.total_chapters, completed_chapters: book.completed_chapters, status: book.status, created_at: book.created_at },
  chapters: insertedChapters || [],
});
```

### 7. Error handling
Wrap the whole handler in try/catch. On unexpected error:
- If a partial book+chapters insertion failed, rollback by deleting the book row (by id + user_id guard).
- Log the error and return 500 with `{ success: false, error: 'Internal server error' }`.

---

## Constraints & Guards
- **BOLA:** Every query uses `req.user.id` (set by `authMiddleware`). Book insert includes `user_id`; chapter rollback filter includes `.eq('user_id', req.user.id)`.
- **Atomicity best-effort:** No DB transaction RPC exists. Insert book first; if chapters insert fails, rollback by deleting the orphaned book row (filtered by `user_id` to prevent BOLA).
- **No credit deduction:** Ingestion is free; credits are only deducted during synthesis.
- **No cover_url handling:** Leave as null/default.

---

## Validation
After implementing, run:
```
node --check server/src/routes/studioRoutes.js
```
Then test with a sample payload via curl or Postman:
```
curl -X POST http://localhost:4001/api/studio \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","chapters":[{"title":"C1","text":"Hello"},{"title":"C2","text":"World"}]}'
```
Expected: 200 with `book` and `chapters` arrays; DB rows appear in `books` and `chapters`.

---

## Files to Edit
- `server/src/routes/studioRoutes.js` — add `POST /` handler between `GET /` and `GET /:bookId`
