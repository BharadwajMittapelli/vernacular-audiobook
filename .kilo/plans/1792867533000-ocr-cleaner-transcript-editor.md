# DEV A — Auto-Text Normalization (OCR Cleaner) — Transcript Editor

**Branch:** `master` · **Scope:** `client/src` (`components/studio/`, `services/`, `pages/Dashboard.jsx`)

## Context (verified — contradicts the brief's assumption)
- **There is no editable Transcript textarea today.** The Transcript tab (`Dashboard.jsx:353-364`) renders `ReadAlongPlayer`, which is fully read-only: synced `TranscriptHighlighter` when audio+alignment exist, raw `chapterText` div otherwise. `Read Along` tab renders the identical component.
- **No client method exists for chapter editing**, though the server endpoint does: `PUT /api/studio/chapters/:chapterId` (`studioRoutes.js:397`) accepts `{ title?, text_content? }`, strips markdown, recalcs `char_count`, resets status to `pending`, BOLA-guarded, 409 while `processing`.
- `api.js` has no `updateChapter`; add one.
- Server's `stripMarkdown` only removes `#*_\[]` — it never touches newlines, so client normalization is complementary, not duplicated.

## User-confirmed decisions
1. **Build the editor with DB persistence**: Transcript tab becomes textarea + toolbar (`✨ Clean Text`, `Save` via new `updateChapter` API call); Save updates the DB and local `book` state.
2. **Transcript = editor, Read Along = synced view** (untouched).

## Task 1 — `client/src/services/textNormalizer.js` (new)
Pure function, mirrors the `chapterSplitter.js` services convention (keeps `components/` for UI; deviation from the brief's literal "components" path is deliberate and documented here).

```js
export function cleanOcrText(text) {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');                    // normalize CRLF first
  out = out.replace(/([A-Za-z]+)-\n(?=[A-Za-z])/g, '$1');  // 1. de-hyphenate line breaks
  out = out.replace(/(?<!\n)\n(?!\n)/g, ' ');               // 2. single \n → space, keep \n\n
  out = out.replace(/[ \t]{2,}/g, ' ');                     // 3. collapse spaces/tabs
  out = out.replace(/[ \t]+\n/g, '\n');                     //    trailing spaces before breaks
  out = out.replace(/\n{3,}/g, '\n\n');                     //    cap runaway blank lines
  return out.trim();
}
```
Notes the implementer must preserve:
- Order is load-bearing: de-hyphenate **before** newline-collapsing, else `com-\nputer` becomes `com- puter`.
- `(?<!\n)\n(?!\n)` keeps `\n\n` intact (paragraph spacing contract with `audioStitcher.js` silence injection); a `\n\n\n` run keeps its first break as paragraph, extra collapses via the `\n{3,}` rule.
- Regex `[A-Za-z]` only (per brief): Indic hyphenation untouched — acceptable, note in doc comment.
- Function must be idempotent: `cleanOcrText(cleanOcrText(x)) === cleanOcrText(x)` (validates safe double-application by the failsafe).

## Task 2 — `client/src/services/api.js`
Add:
```js
export function updateChapter(chapterId, payload) {
  return api.put(`/api/studio/chapters/${chapterId}`, payload).then((res) => res.data);
}
```
(`payload` = `{ text_content }`; response `{ success, chapter }`.)

## Task 3 — `client/src/components/studio/TranscriptEditor.jsx` (new)
Props: `chapter`, `onSaved(chapter)`, `onError(msg)` (reuse Dashboard's `setError` banner).

Internal state: `draft` (textarea value, re-initialized via `useEffect` on `chapter.chapterId`), `saving`, `dirty = draft !== chapter.text`.

Layout (match Dashboard's existing Tailwind idiom — `text-sm`, `border-border`, `text-terracotta`):
- Toolbar row above the textarea: left = char count + dirty dot indicator (`Unsaved changes`); right = two buttons:
  - `✨ Clean Text` (lucide `Wand2` icon): `setDraft(cleanOcrText(draft))`. Disabled when `!dirty && cleanOcrText(draft) === draft`… simpler: always enabled, no-op is harmless (idempotent).
  - `Save` (primary style like Dashboard's Generate button, smaller): calls `updateChapter(chapter.chapterId, { text_content: cleanOcrText(draft) })`, then `onSaved(res.chapter)`; shows `Saving…` spinner while in flight; disabled when `!dirty || saving`.
- `<textarea>`: controlled by `draft`, `className` serif prose styling consistent with the read view (`font-serif`, `leading-relaxed`, `whitespace-pre`), min-height ~`h-[60vh]`, `scrollbar-thin`, `resize-y`.
- Errors from `updateChapter` → `onError(err.response?.data?.error || 'Failed to save chapter')`. A server 409 (chapter synthesizing) surfaces verbatim — no special client handling.

## Task 4 — `client/src/pages/Dashboard.jsx`
1. Transcript tab body (currently `ReadAlongPlayer`) → `<TranscriptEditor chapter={chapter} onSaved={...} onError={setError} />`. Leave the `read-along` tab exactly as-is.
2. `onSaved` merge helper tolerant of the two id shapes in play (upload returns `{id, text}`, GET book returns `{chapterId, ...}`):
   ```js
   const updated = { ...chapter, text: c.text_content, chapterId: chapter.chapterId ?? chapter.id, /* merge returned counts */ };
   setBook((b) => ({ ...b, chapters: b.chapters.map((ch, i) => (i === activeIdx ? updated : ch)) }));
   ```
   `estimatedCredits` already derives from `chapter.text` → auto-refreshes after clean/save.
3. **Failsafe**: in `handleGenerate` (`Dashboard.jsx:211`) send `text: cleanOcrText(chapter.text)`; in `generateAll` (`Dashboard.jsx:234-240`) map to `text: cleanOcrText(ch.text)`. Import `cleanOcrText` in both places (it lives in services, one import in Dashboard).

## Failsafe / double-application analysis
- `synthesizeAudio`/`synthesizeAsync` payloads now carry cleaned text; the DB copy may still be raw until the user hits Save — acceptable, both synthesis paths run `stripMarkdown` server-side and the paragraph structure survives (clean only *normalizes*, never removes `\n\n`).
- Credits: client badge uses `chapter.text.length`; server charges `stripMarkdown(payload).length` — cleaning reduces length, so the badge can only over-estimate. Safe direction; note it.

## Failure modes & edge cases
- Empty textarea → Save disabled (`!draft.trim()`), server 400 also covered.
- Chapter `processing` → server 409 → error banner (client has no status tracking; accepted).
- Chapter switch with unsaved draft → draft resets to the new chapter (silent discard; matches current no-persistence UX; note for future).
- Post-generation edits don't retroactively change existing audio/alignment; transcript stays editable so re-generate picks up cleaned text.
- `crypto`/API auth untouched — `api.js` interceptor already attaches the JWT.

## Validation
1. `npm run typecheck` and `npm run build` in `/client` (brief-mandated).
2. Scratch node check for the pure function (`.mjs` outside the vite project, delete after):
   - `"This is a sen-\ntence split.\n\nNew para."` → `"This is a sentence split.\n\nNew para."`
   - `"line one\nline two\n\npara two"` → `"line one line two\n\npara two"`
   - CRLF input `"a\r\nb\r\n\r\nc"` → `"a b\n\nc"`
   - `"a   b\n\n\nc"` → `"a b\n\nc"`; trailing-space before break removed.
   - Idempotency on all samples.
   - Assert `\n\n` count is never reduced by any rule.
3. Manual smoke: upload a hard-wrapped `.txt` book → Transcript tab shows editor → Clean Text collapses lines, keeps paragraphs → Save → reload book from server, persisted text is clean → Generate Audio succeeds with unchanged alignment schema.

## Files changed
- `client/src/services/textNormalizer.js` (new)
- `client/src/components/studio/TranscriptEditor.jsx` (new)
- `client/src/services/api.js` (+`updateChapter`)
- `client/src/pages/Dashboard.jsx` (transcript tab body, `onSaved` merge, cleanOcrText failsafe in both generate paths)

## Out of scope
- Server-side normalization anywhere (translation pipeline explicitly preserved `\n\n`).
- Read Along / TranscriptHighlighter behavior, storefront embed, bulk-progress UI.
- Undo history for Clean Text.
