# JIT Transcript Normalization (Groq transliterate-before-TTS)

## Goal
Ingest stays instant; each chapter is normalized (clean PDF artifacts + translate narrative to target Indic language while preserving English loanwords in native script) **just-in-time** via a dedicated route, triggered from the Studio UI before any TTS synthesis. A chapter with `normalized=false` must NEVER reach a TTS engine for an Indic language (raw Latin text would be spelled out by Gnani).

## Decisions already made (do not revisit)
- Hook point: **JIT per chapter**, not at upload, not inside `synthesizeText`.
- Fires **only for the 9 Indic codes** (`hi-IN te-IN ta-IN kn-IN ml-IN mr-IN bn-IN gu-IN pa-IN`). `en-IN` and Hinglish `hi-en` never normalize (server-side guard, not just client).
- **No silent fallback to raw text.** On Groq failure the chapter stays `normalized=false`, returns an error, and is blocked from synthesis until the user retries.
- Model: hardcoded `qwen-2.5-32b` in the user's snippet is **not a valid model ID on this account**. Use repo pattern: `process.env.GROQ_NORMALIZER_MODEL || 'qwen/qwen3.8-27b'` (same as `llmDirector.js:5`, `genreClassifier.js:5`).
- `translateToIndic` in `textProcessor.js` stays as-is for `en-IN`/`hi-en` and legacy rows; it already short-circuits on Indic glyphs, so normalized text passes through untouched.
- `preserved_words` is a display/debug artifact only — no downstream consumer; store it, don't branch on it.
- Manual-edit flip is implemented on the **existing `PUT /api/studio/chapters/:chapterId`** (already used by `updateChapter()` in `client/src/services/api.js:108`), not a new `PATCH /api/chapters/:id` — one edit endpoint, no dead duplicate route.

## Tasks

### 1. Migration — `server/migrations/014_add_chapter_normalization.sql`
```sql
alter table public.chapters
  add column if not exists raw_text text,
  add column if not exists normalized boolean not null default true,
  add column if not exists normalized_words jsonb;

update public.chapters set raw_text = text_content where raw_text is null;
```
- `raw_text` keeps the extracted PDF/DOCX/EPUB text permanently (retry source + user edit safety).
- Default `true` = existing rows and en-IN books are synthesis-eligible immediately.
- Follow existing migration style (idempotent, `if not exists`). Do not run mutating commands yourself — flag for the implementer/user.

### 2. New service — `server/src/services/transcriptNormalizer.js`
- Base implementation from the user-supplied snippet, with these fixes:
  - `const MODEL = process.env.GROQ_NORMALIZER_MODEL || 'qwen/qwen3.8-27b';` (remove hardcoded `qwen-2.5-32b`).
  - **Remove the swallow-and-return-raw catch.** Let Groq/JSON-parse errors propagate; route decides. Guard non-JSON content by stripping markdown fences before `JSON.parse`; a failed parse is still an error.
  - Add `export function needsNormalization(language, text)`:
    - `false` when language is `en-IN` or `hi-en`;
    - `false` when `/[\u0900-\u0D7F]/.test(text)` (already in native script — no Groq call, no cost);
    - `true` otherwise.
  - Add `buildChunks(text)` helper — robust two-level chunking (many PDFs extract with single `\n` only, so double-newline splitting alone is insufficient):
    1. Split at paragraph boundaries (`/\n{2,}/`); keep paragraph separators when rejoining final output.
    2. Any piece still > **3,500 chars**: split at sentence boundaries using `/(?<=[.!?।])\s+/` (same splitter idea as `textProcessor.js:19`, incl. danda `।`).
    3. Greedily pack resulting sentences/paragraphs into chunks ≤ **4,000 chars**; a single oversized sentence stays one chunk.
  - Process chunks **sequentially** (rate-limit safe); for each Groq response parse JSON, extract `normalized_text`, append to a final `completeText`; merge all `preserved_words` dicts into one object. Any chunk failure aborts the whole call — no partial text is ever returned.
  - Add `max_tokens: 16000` and `response_format: { type: 'json_object' }` (pattern: `llmDirector.js:54-60`).
- Keep the prompt semantics exactly: clean artifacts, translate narrative structure, preserve English loanwords written in target script, return `{normalized_text, preserved_words}`.

### 3. New route — `server/src/routes/chapterRoutes.js`, mounted in `server/src/index.js`
Mount after the studio block (auth applied like the others): `app.use('/api/chapters', authMiddleware, chapterRoutes)`.

**`POST /api/chapters/:chapterId/normalize`**
1. Load chapter scoped by BOTH `id` and `user_id = req.user.id` (BOLA guard, same pattern as studio routes). 404 otherwise.
2. `409` if `chapter.status === 'processing'` (mid-synthesis) or `chapter.normalized === true` (idempotency — re-normalizing normalized text would double-translate).
3. If `!needsNormalization(language, raw_text ?? text_content)` → `update { normalized: true }`, return `{ success: true, skipped: true, reason }`. No Groq call.
4. Otherwise `await normalizeTranscript(raw_text ?? text_content, language)`:
   - Success → update `{ text_content: normalized_text, normalized_words: preserved_words, normalized: true }` (keep `raw_text` untouched); recompute `char_count` and `estimated_duration_seconds = ceil(len/15)` exactly like `studioRoutes.js:270-278`. Return `{ success: true, normalized: true, char_count, preserved_words }`.
   - Failure → log `[TranscriptNormalizer] chapter <id> failed`, return `502 { success: false, error: 'Script optimization failed. Please retry.' }` and change **nothing** (`normalized` stays false, no partial write).

**Manual-edit flip (corrected from a new PATCH route):** the repo already has `PUT /api/studio/chapters/:chapterId` (studioRoutes.js:781) and `TranscriptEditor.jsx` already saves through `updateChapter()` (`client/src/services/api.js:108`). Extend that existing route instead of adding a duplicate PATCH endpoint (directive's `PATCH /api/chapters/:id` — see Decisions).

### 4. `server/src/routes/studioRoutes.js`
- **`POST /` (book create, ~line 228):** make `language` **required and valid** (400 if missing/invalid — currently silently defaults to `en-IN`, which would wrongly skip normalization for Indic books). In `chaptersData` add `raw_text: cleanText` and `normalized: !needsNormalization(effectiveLang, cleanText)`. Keep the response shape; add `normalization_required: <count of normalized=false chapters>` so the client knows to JIT-normalize.
- **`POST /:bookId/synthesize-all` (~line 331):** before selecting pending chapters, load `id, sequence_number, normalized` for the book; if any selected (`status in ['pending','failed']`) chapter has `normalized=false` → `409 { error: 'Chapters require script optimization before synthesis', chapter_ids: [...] }` and do not start the worker. (Client normalizes those serially, then retries.)
- **Single-chapter synthesize route** (the one with the `chapter.status === 'processing'` check ~line 801): same guard → `409 { error: ..., chapter_id }` whenever `normalized=false`. Keep the invariant unconditional (all insert paths set `normalized` deliberately, and PATCH on en-IN edits re-sets it true, so `normalized=false` always means "needs optimize").
- **`PUT /chapters/:chapterId` (~line 781, manual-edit safety):** add `language` to the guard select; inside the `text_content !== undefined` branch (lines 813-822) add `updates.normalized = needsNormalization(chapter.language, cleanText)` alongside the existing `char_count`/`estimated_duration_seconds`/`status` recompute. Effect: any hand edit of an Indic chapter immediately flips it to `normalized=false`, re-blocking synthesis until re-optimized; `en-IN`/`hi-en` edits (and edits reintroducing already-native-script text) stay eligible. Add `normalized` to the response select (line 829) so the editor can re-render the button state from the same response. `raw_text` is never overwritten here.
- **GET book/chapters routes:** include `normalized` (and `raw_text` where the transcript editor reads text) in selects (e.g., line 742) so the UI can render state.
- Keep existing credit-refund catch-blocks and BOLA guards untouched.

### 5. Client — Studio UI (`client/src/`)
- New shared helper `normalizeChapter(chapterId)` (fetch with auth header, same style as existing API calls in the studio components).
- **`components/studio/TranscriptEditor.jsx`:** add a visible **"Optimize Script for TTS"** button shown when `chapter.normalized === false`; disabled/spinner while running; on success refresh the displayed text with `text_content`; on error show retry message. After a manual save via `updateChapter()`, update local chapter state from the PUT response's `normalized` field so the button **reappears immediately**, forcing re-optimization before synthesis.
- **Auto-trigger:** when the user opens a chapter with `normalized=false` (ChapterListPanel selection handler) fire `normalizeChapter` once and refresh.
- **Generate Audio flow** (`AudioConfigModal.jsx` / studio page that calls synthesize / synthesize-all): before dispatch, normalize all `normalized=false` chapters serially with progress ("Optimizing script 3/30…"); surface 502s as per-chapter retry prompts. On `409 chapter_ids` from the server (race), normalize those and retry once.
- `en-IN` / `hi-en` books: no button, no trigger (server also enforces).

### 6. Docs — `PROJECT_DOCUMENTATION.md`
Add the normalize endpoint + `normalized` lifecycle to the API/flow section.

## API contract summary
| Route | Change |
|---|---|
| `POST /api/studio` | requires valid `language`; stores `raw_text`, `normalized`; response adds `normalization_required` |
| `POST /api/chapters/:id/normalize` | new; 200 `{success, normalized, skipped?, char_count?, preserved_words?}`, 404/409/502 |
| `POST /api/studio/:bookId/synthesize-all` | 409 + `chapter_ids` when any target chapter unnormalized |
| `PUT /api/studio/chapters/:id` | text edit now recomputes and sets `normalized` (`needsNormalization`); response includes `normalized` |
| `POST /api/studio/chapters/:id/synthesize` | 409 when `normalized=false` |

## Risks
- **Rate limits:** JIT makes Groq calls one-chapter-at-a-time, user-paced — safest possible profile vs. bulk-at-upload. Client trigger loops must stay serial.
- **Re-normalize double-translation:** prevented by 409 on `normalized=true` + always translating from `raw_text`.
- **User edits transcript after normalizing:** the extended `PUT /chapters/:id` sets `normalized = needsNormalization(language, new text)`, so any Latin-script edit of an Indic chapter immediately re-blocks synthesis and the UI button reappears. Native-script edits stay eligible.
- **Truncation:** two-level chunking (paragraph → sentence, ≤4,000 chars) in the service; single oversized sentence passes through as one chunk rather than being hard-cut.
- **Existing books:** migration defaults `normalized=true`; they never re-translate (Indic short-circuit in `translateToIndic` remains their path).

## Validation
1. `node --check` each edited server file.
2. Apply `014_add_chapter_normalization.sql` (implementer/user action).
3. `POST /api/studio` with `language=te-IN` + English sample → chapters return `normalized:false`, `raw_text` stored, response includes `normalization_required`.
4. `POST /api/studio/:bookId/synthesize-all` before normalizing → expect 409 with `chapter_ids`.
5. `POST /api/chapters/:id/normalize` → `text_content` in Telugu script with Latin loanwords transliterated (e.g., hospital → హాస్పిటల్); `normalized_words` populated; second call → 409.
6. Retry after temporarily clearing `GROQ_API_KEY` → 502, `normalized` still false, `text_content` unchanged.
7. `language=en-IN` upload → `normalized:true`, zero Groq calls (log check), synthesizes as before.
8. Already-Indic input (hi-IN Telugu PDF) → normalize returns `skipped:true`, no Groq call.
9. BOLA: normalize a chapter id belonging to another user → 404.
10. Synthesize after normalization → Gnani receives Indic-script text only (verify provider payload/log).
11. `PUT /api/studio/chapters/:id` on a normalized Indic chapter with Latin-script edit → response `normalized:false`; subsequent single synthesize → 409; re-run normalize → 200 and 409 cleared. Title-only PUT must NOT flip `normalized`.
12. Chunking: chapter with a single ~8k-char paragraph (no `\n\n`) still normalizes fully (no truncated `text_content`); `node --input-type=module -e` smoke test of `buildChunks` on such input asserting every returned chunk ≤ 4,000 except a single oversized sentence.
