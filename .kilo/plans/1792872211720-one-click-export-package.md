# Harden Export Package audio download (v2)

## Context
v1 (Export Package button + `handleExport`) is implemented **inline in `client/src/pages/Dashboard.jsx`** (uncommitted, `M` in git status). `client/src/components/studio/ExportPackageButton.jsx` does not exist and will NOT be created — user confirmed the hardening stays inline in Dashboard.jsx.

Reported symptom: text `.txt` exports fine; audio export fails / downloads without extension / unusable file.

Ground truth from the stack (do not contradict):
- Supabase `uploadAudio` stores an explicit `contentType` (`audio/wav` or `audio/mpeg`) at `server/src/services/storageService.js:55-63` → blob MIME is reliable on success.
- An expired/invalid signed URL returns a **non-200 with an error body** — current code already throws on `!res.ok`, but a 200-with-non-audio-body (proxy/CDN error page) would still be saved as an "unusable file". Add a MIME guard.
- Current revoke delay is 1000ms via shared `downloadBlob`; large binaries may need more.

## Task: modify `handleExport` in `client/src/pages/Dashboard.jsx`
Edit only the audio-download section (~Dashboard.jsx:275-318). Text download section unchanged.

1. **Explicit URL guard** (after the getChapterAudio refresh attempt):
   ```javascript
   if (!url) throw new Error('No audio URL available');
   ```
2. **Keep** the fresh-URL refresh (`getChapterAudio(chapter.chapterId)` → fall back to held `audioUrl`) and `if (!res.ok) throw` (status in message).
3. **Non-audio body guard** (prevents saving error JSON/HTML as a file):
   ```javascript
   const blob = await res.blob();
   if (blob.type && !blob.type.startsWith('audio/')) {
     throw new Error(`Unexpected audio content-type: ${blob.type}`);
   }
   ```
4. **Strict extension** — replace the current MIME/URL-regex chain (delete the `new URL(url).pathname...` branch; also removes a `new URL` throw path):
   ```javascript
   const ext = (blob.type === 'audio/mpeg' || blob.type === 'audio/mp3') ? 'mp3' : 'wav';
   ```
   Safe because uploads always set MIME explicitly (storageService.js:57-62); empty/MIME-less blobs default to `.wav` per spec.
5. **Delay revoke for audio:** give `downloadBlob` a timeout param — `const downloadBlob = (blob, name, revokeMs = 1000)` with `setTimeout(() => URL.revokeObjectURL(url), revokeMs)`; audio call uses `downloadBlob(blob, `${safe}.mp3|.wav`, 2000)`. Text call unchanged (default 1000).
6. **Error message** via existing `setError`: `'Audio download failed — the link may have expired or CORS blocked it. Try again.'`

No new files, no new deps, no server changes.

## Failure modes handled
- Expired signed URL → `!res.ok` throw → ErrorBanner, `.txt` still downloaded.
- 200-with-error-page body → content-type guard throws instead of saving junk.
- gTTS MP3 fallback → `.mp3` from `audio/mpeg`; anything unknown → `.wav` default.
- Large file revoked before transfer → 2000ms revoke delay on audio.
- Double-click → existing `isExporting` guard.

## Validation
1. `npm run build` and `npm run typecheck` in `client/` (must pass — they did for v1).
2. Manual: generate chapter audio → Export → `.txt` + audio file both download with correct extension and play; switch chapters → follows active chapter; button disabled before generation.
3. Stale-URL path: wait >1h (or invalidate) → click Export → fresh URL auto-refresh downloads fine; if both URL paths fail → error banner, no extension-less file lands in Downloads.
