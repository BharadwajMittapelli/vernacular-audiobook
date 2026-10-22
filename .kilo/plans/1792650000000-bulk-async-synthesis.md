# Plan: POST /:bookId/synthesize-all — Bulk Async Synthesis

**Scope:** `server/src/routes/studioRoutes.js` ONLY  
**Goal:** Fire-and-forget bulk TTS generation for all `pending`/`failed` chapters of a book, with per-chapter credit deduction and refund-on-failure.

---

## Context (verified)
- Route order in `studioRoutes.js`: `GET /` (13), `POST /` (30), `GET /:bookId` (111), `GET /chapters/:chapterId` (142), `POST /chapters/:chapterId/synthesize` (187). New `POST /:bookId/synthesize-all` goes **immediately before `GET /:bookId`** (before line 111).
- Single-chapter endpoint (187-311) is the template for the per-chapter worker: `synthesizeText → auditAudio → uploadAudio → insert audio_generations (with chapter_uuid) → set chapter completed`, refund in catch. **`auditAudio` is a hard gate** (project constraint): must run after synthesis, before upload; failure ⇒ refund + mark failed.
- `creditService.js`: `calculateCost(chars)` = `ceil(chars/100)`; `deductCredits/refundCredits(userId, charCount, refId)` via RPC; `InsufficientCreditsError` thrown on wallet drain.
- `char_count` in `chapters` already stores the **stripped** length (ingest endpoint), so pre-flight on `char_count` matches the deduction basis. Deduct per chapter with `chapter.char_count` exactly as specified.
- Books/chapters queries must be BOLA-scoped; `req.user.id` comes from `authMiddleware`.
- In-memory detached worker is intentional here (in-process queue durability was explicitly deferred in project decisions). Server restart mid-run leaves chapters in `pending/processing` — acceptable, retry via re-calling this endpoint.

---

## Endpoint spec

`POST /api/studio/:bookId/synthesize-all`  
Body: `{ "language": "hi-IN", "voiceProfile": "hi-IN-female-1", "speed": 1.0 }`

### Step 0 — Validate (trust boundary)
- `language`, `voiceProfile` required → 400 if missing (mirror single-endpoint check).
- Fetch book: `.from('books').select('id, status').eq('id', req.params.bookId).eq('user_id', req.user.id).single()` → 404 if missing.
- **Concurrency guard:** `if (book.status === 'processing') return 409 { error: 'Synthesis already in progress' }` — prevents double-charge race. *(Deliberate addition to spec: protects the money path; one line.)*

### Step 1 — Pre-flight
- Fetch chapters: `.from('chapters').select('id, char_count, text_content').eq('book_id', bookId).in('status', ['pending', 'failed']).order('sequence_number')`.
- Empty array → 400 `{ success: false, error: 'No chapters need processing' }`.
- `totalCost = chapters.reduce((sum, ch) => sum + calculateCost(ch.char_count), 0)`.
- Balance: `.from('users').select('credits').eq('id', req.user.id).single()`.
- `balance < totalCost` → 402 `{ success: false, error: 'Insufficient credits...' }`.

### Step 2 — Transition + response
- `.from('books').update({ status: 'processing' }).eq('id', bookId).eq('user_id', req.user.id)`.
- `res.status(202).json({ success: true, message: 'Bulk synthesis started', totalChapters: pendingChapters.length })`.

### Step 3 — Detached worker (`Promise.resolve().then(async () => {...})`, NOT awaited)
Capture `userId = req.user.id` before the response (req is mutable after res; don't touch `req` inside worker).

**Chapter scoping (approved correction):** all `chapters` queries/updates in this route are scoped by `.eq('book_id', bookId)` ONLY — do NOT add `.eq('user_id', ...)` to chapters. `book_id` is transitively safe because Step 0 validated the book against `req.user.id`. (Note: `chapters.user_id` DOES exist in the live schema — verified via `information_schema` 2026-10-18 — but omitting the filter here is still BOLA-safe and is the approved convention for this route. Existing endpoints keep their `user_id` filters untouched.)

Per chapter, sequentially:
1. `chapters.update({ status: 'processing' }).eq('id', ch.id).eq('book_id', bookId)`.
2. `generationId = uuidv4()`.
3. `await deductCredits(userId, ch.char_count, generationId)` in its own try/catch:
   - `InsufficientCreditsError` → **reset this chapter to `'pending'`** (it was flipped in step 1; leaving it `'processing'` strands it forever), then `break` the loop.
   - other error → mark chapter `'failed'`, `continue`.
4. `cleanText = stripMarkdown(ch.text_content)`; `synthesizeText(cleanText, language, voiceProfile, speed)`.
5. `auditAudio(result.audioBuffer, cleanText, result.totalDuration)` — hard gate.
6. `uploadAudio(result.audioBuffer, ch.id, result.source === 'gtts' ? 'mp3' : 'wav')`.
7. Insert `audio_generations` row **exactly as single-chapter path** (id, user_id, chapter_id, chapter_uuid, language, audio_url,/audio_path, duration, alignment, credits_used: `calculateCost(ch.char_count)`, status 'completed'). Include `book_id: bookId` too — the column exists and the async worker in audioRoutes uses it for progress tracking.
8. `chapters.update({ status: 'completed' }).eq('id', ch.id).eq('book_id', bookId)`.
9. **Catch for steps 4-8:** `refundCredits(userId, ch.char_count, generationId)` wrapped in try/catch (log `CRITICAL:` on refund failure, same as line 293) → `chapters.update({ status: 'failed' }).eq('id', ch.id).eq('book_id', bookId)` → `continue`.

Outer worker body wrapped in try/catch too: unexpected throw (e.g. status update to DB down) → log and force `books.status = 'failed'` so the book never hangs in `'processing'`.

### Step 4 — Aggregate (after loop/break, still in worker)
- `remaining = await supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('book_id', bookId).in('status', ['pending', 'failed'])`.
- `books.update({ status: remaining === 0 ? 'completed' : 'failed' }).eq('id', bookId).eq('user_id', userId)`.

---

## Decisions & constraints honored
- **Per-chapter deduction only** (spec constraint 1) — batch deduction would break `refund_credits` RPC keyed by `p_ref_id = generationId`.
- **BOLA (constraint 2):** book validated against `user_id` up front (Step 0); chapter access transitively scoped by `.eq('book_id', bookId)` on every chapters query/update in this route (per approved correction — no `user_id` filter on chapters); books status updates scoped by `.eq('user_id', userId)`.
- Deduction basis = stored `char_count`, matching pre-flight sum — no drift between estimate and charge.
- `completed_chapters` on books NOT updated here (spec silent; storefront/queue paths own that counter). Flag if UI needs it.
- Speed defaults through `synthesizeText` as in single path (no extra validation).

## Failure modes
| Scenario | Result |
|---|---|
| Balance fine pre-flight, drained mid-loop | Chapter reset to `pending`, loop breaks, book → `failed`. Retry re-picks it up. |
| TTS/storage failure on chapter N | Refund for N, chapter `failed`, loop continues. |
| Refund itself fails | Logged `CRITICAL`, chapter still marked `failed` (manual reconciliation). |
| Second click while running | 409 via status guard. |
| Server dies mid-run | Chapters stay `processing`; book `processing`. Manual reset/retry — accepted (durability deferred by project decision). |

---

## Validation
1. `node --check server/src/routes/studioRoutes.js`
2. Pattern check (grep/temp script): route registered between `POST /` and `GET /:bookId`; worker not awaited; `refundCredits` inside catch; `auditAudio` before `uploadAudio`; every chapters update in the new route contains `.eq('book_id'` and does NOT contain `.eq('user_id'`; every books update contains `.eq('user_id'`.
3. Manual: single pending chapter + valid token → 202; poll `GET /:bookId` until chapters `completed`, book `completed`. Insufficient-credits account → 402 before any insert. Second concurrent call → 409.

## File to change
- `server/src/routes/studioRoutes.js` — insert `POST /:bookId/synthesize-all` immediately before the `GET /:bookId` handler (line ~111). No new imports needed (uuid, creditService, ttsProvider, storageService, audioAuditService, stripMarkdown all already imported).
