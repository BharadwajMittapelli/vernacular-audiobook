# Rate-limit tiering — remaining steps (tasks 1-2 shipped)

## Done (already applied and syntax-valid)
- `server/src/index.js`: global apiLimiter relaxed 5 → **60/min**, `/health` added to skip, message reworded to "Too many requests, please slow down" so it's distinguishable from spend-bucket 429s.
- `server/src/routes/audioRoutes.js`: `rateLimit` imported; **5/min `ttsLimiter` mounted on `POST /synthesize`** (before `creditGuardMiddleware`); bulk `synthesize-async` untouched (still dedicated 2/min in index.js).
- `server/src/routes/studioRoutes.js`: `rateLimit` imported; `chapterTtsLimiter` (5/min) and `bulkLimiter` (2/min) **defined** near the top of the file.

## Remaining tasks
1. **Attach the two studio limiters** (definitions exist but routes are still unguarded):
   - `router.post('/:bookId/synthesize-all', bulkLimiter, async ...)` — studioRoutes.js line ~130.
   - `router.post('/chapters/:chapterId/synthesize', chapterTtsLimiter, async ...)` — studioRoutes.js line ~457.
2. **Verify stray "nrw" comment artifacts** in studioRoutes.js comments (~lines 129, 456) with a byte-level `rg nrw server/src`; delete if real (earlier grep/read output showed display artifacts, so confirm before touching). Same check for `server/test-gnani-api.js` — it was deleted in an earlier sprint but appears in the search index; confirm it's absent on disk.
3. **Validation**
   - `node --check` on all three changed files.
   - Restart server; repeat the user flow (load Studio → upload docx → create book → open → synthesize-all → poll status) within one minute → no 429.
   - `POST /api/studio/:id/synthesize-all` 3× → 3rd returns 429 "Too many bulk requests...".
   - `POST /api/audio/synthesize` 6× → 6th returns 429 "Too many synthesis requests, max 5 per minute" (use dev-mode auth: no header needed with NODE_ENV=development).
   - `GET /health` never counts.

## Decision context (for reference)
Root cause: global limiter was 5/min on every route; the book-creation flow alone makes ≥5 reads, so the 6th action of any kind answered "Too many requests from this IP, please try again after a minute". PROJECT_DOCUMENTATION.md threat model only ever intended 5/min sync-TTS / 2/min bulk caps — restored via per-route buckets; global 60/min now covers list/detail/poll traffic.
