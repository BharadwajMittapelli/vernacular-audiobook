# DEV B — Architectural Paragraph Spacing (WAV silence stitching)

**Branch:** `master` · **Scope:** `server/src/services/` (`audioStitcher.js`, `ttsProvider.js`, `textProcessor.js`)

## Goal
Gnani TTS reads `\n\n` with a period-length micro-pause. Split each chapter into paragraphs, synthesize paragraph-wise, and inject a mathematically exact 600 ms silent PCM gap between paragraph audio at the binary level, with pseudo-timestamps offset so Read-Along stays in sync.

## User-confirmed decisions
1. **Silence length is derived, not hardcoded.** The brief claims 16 kHz mono 16-bit (32,000 B/s → 19,200 bytes), but the live payload requests `sample_rate: 48000, num_channels: 1, sample_width: 2` (`ttsProvider.js:150` → 96,000 B/s → 57,600 bytes). `buildSilenceBuffer()` parses `byteRate` from the WAV `fmt ` chunk; fallback 19,200 bytes only if header parse fails. Request payload stays 48000.
2. **Paragraph-preserving translation added** (approved scope extension into `textProcessor.js`): today `translateToIndic` rejoins chunks with `' '` (`textProcessor.js:100`, `:114`), destroying all `\n\n` before `synthesizeWithGnani` sees Indic text → paragraph chunking would find one paragraph and inject zero silence for every non-English book.
3. **gTTS path untouched.** MP3 containers + silent-PCM injection is invalid; `stitch()` gains an optional `silenceMs` defaulting to `0`, so the gTTS call site behavior is bit-identical to today.

## Files & current contract
- `synthesizeText` returns `{ audioBuffer, totalDuration, alignment, source }`; consumers (`audioRoutes.js:265`, `studioRoutes.js:220/:525`, `synthesisQueue.js:129`) + `auditAudio(buffer, text, durationSeconds)` (`audioAuditService.js`) must not change shape. Alignment schema `[{sentenceIndex, text, startTime, endTime}]` is immutable (DB JSONB + ReadAlongPlayer).
- `stitch()` currently: keeps chunk-1's 44-byte header, blind-strips `subarray(44)` from later chunks, writes sizes at offsets 4/40, offsets timestamps by cumulative durations.
- Gnani streaming WAVs may carry a `0xFFFFFFFF` data-size sentinel; hardcoding 44 only works for canonical PCM headers.

## Task 1 — `audioStitcher.js`
1. Add `const DEFAULT_PARAGRAPH_SILENCE_MS = 600;` (export it) and keep `WAV_HEADER_SIZE = 44`.
2. `getWavByteRate(wavBuffer)` → walk chunks to `fmt `, return `readUInt32LE(p+16)` (byte rate), `0` if absent/not RIFF.
3. `buildSilenceBuffer(ms, byteRate)` → `Buffer.alloc(Math.round(ms / 1000 * byteRate) & ~1)` (even-byte clamp so 16-bit sample alignment is never broken). If `byteRate` is 0 → fall back to 32,000 (16k×2). Reuse one silence buffer for all gaps.
4. `extractPcm(wavBuffer)` → chunk-walk to the `data` chunk, return `wavBuffer.subarray(dataStart, dataStart + Math.min(dataSize, available))`. For the **silence path only** (robustness, per brief constraint #1). If no `data` chunk found, fall back to `subarray(44)`.
5. `stitch(audioBuffers, chunkTimestamps, chunkDurations, silenceMs = 0)`:
   - 0/1-buffer early returns: unchanged (no gap exists).
   - `silenceMs === 0` → existing legacy byte path exactly (blind `subarray(44)`, in-place size writes at 4/40). Required so gTTS output is bit-identical.
   - `silenceMs > 0` →
     - `byteRate = getWavByteRate(audioBuffers[0])`; `silence = buildSilenceBuffer(silenceMs, byteRate)`; `gapSec = silence.length / (byteRate || 32000)`.
     - Build parts: `extractPcm` of chunk 0, then for each later chunk `(hasGap(i-1) ? silence : nothing)` + `extractPcm(chunk)`; `hasGap(i)` is `gapIndices ? gapIndices[i] : silenceMs > 0`. One `Buffer.concat(parts)` (single allocation, no per-append reallocation; reuse the same silence Buffer reference for every gap — concat copies, no extra allocations).
     - Write a **fresh canonical 44-byte header**: `RIFF`, chunkSize = `merged.length - 8`, `WAVE`, `fmt ` + size 16 + audioFormat 1 + channel count **copied from chunk 0's fmt** (default 1), sample rate from chunk 0, byteRate, blockAlign, bitsPerSample from chunk 0, `data` + subchunk2Size = `merged.length - 44`. (Preserves sample rate/width even if Gnani changes formats later.)
   - Timestamp offsets: for each chunk `i` except the last, `gapSec_i = hasGap(i) ? silence.length / byteRate : 0` where `hasGap(i)` is `gapIndices ? gapIndices[i] : silenceMs > 0`; `timeOffset += chunkDurations[i] + gapSec_i`. `totalDuration = timeOffset` (no trailing silence after the last chunk).

## Task 2 — `ttsProvider.js` (Gnani path)
1. Paragraph split (per brief): `const paragraphs = text.split(/[\r\n]{2,}/).filter(p => p.trim());` then flatten `paragraphs.map(p => chunkText(p))`, **tracking each sub-chunk's paragraph index** (`chunkText` strips markdown per paragraph; a chapter with no blank lines yields one paragraph → one silence-free chunk set, which is correct). (400-char API cap stays enforced; long paragraphs split at sentence boundaries.)
2. Sequential loop over sub-chunks: `callGnaniApi` per piece — error classification (err.httpStatus / err.retryableCode, hard-fail 4xx incl. 429), 30 s timeout, empty/non-WAV guard: all unchanged; a throw mid-chapter still triggers the existing refund/fallback gates.
3. Per chunk push `{buffer, timestamps: [{start:0, end:chunkDuration, word: piece.trim()}], duration, paragraphIndex}`.
4. Silence at paragraph boundaries only: extend `stitch(audioBuffers, chunkTimestamps, chunkDurations, silenceMs = 0, gapIndices = null)` where `gapIndices` is a boolean array of length `n-1`; `true` at gap `i` means inject silence between chunk `i` and `i+1` (`null` → inject at every gap when `silenceMs > 0`). The Gnani caller sets `gapIndices[i] = true` iff chunk `i` and `i+1` belong to different paragraphs — never between sentence-splits of one paragraph. Timestamp accounting in Task 1 uses `gapIndices[i] ? gapSec : 0` instead of a flat `gapSec`.
5. Return `{ audioBuffer: mergedBuffer, totalDuration, alignment: calculateAlignment(text, cumulativeTimestamps, totalDuration), source: 'gnani' }` — same shape.
6. Note `calculateAlignment` walks timestamps in order; silence-inflated `timeOffset` flows through automatically. `totalDuration` grows by `0.6 s × (number of silence gaps)` → `auditAudio`'s lower-bound ratio check (duration ≥ `text.length/20 × 0.2`) stays satisfied.

## Task 3 — `textProcessor.js` (paragraph-preserving translation)
1. In `translateToIndic`: before splitting, `const paras = text.split(/[\r\n]{2,}/).filter(p => p.trim())`; run the existing Google→MyMemory pipeline per paragraph (reuse inner functions unchanged; only the *input batching* moves inside a paragraph loop) and return `results.join('\n\n')`.
2. Preserve existing behavior when there is exactly 1 paragraph (identical output to today).
3. Single-language early returns (`:26`, `:29`), Indic-script short-circuit (`:34`), logging, retry/backoff: untouched.
   (Cheaper alternative rejected: translating with a delimiter token around `\n\n` — Google mangles invented tokens.)

## Risks
- **Request fan-out:** P paragraphs ⇒ ≥P API calls; sequential at 30 s timeout each ⇒ worst-case latency per chapter is unbounded-ish. Accepted for now (rate-limit posture of vachana unknown); parallel-with-order-preserved is the follow-up knob.
- 429 from vachana is 4xx ⇒ hard-fail (existing policy) ⇒ generation fails + refunds, no silent gTTS masking.
- Header rewrite assumes canonical PCM layout only in the silence path; the legacy `silenceMs=0` path is untouched so gTTS regressions stay impossible by construction.
- `translateToIndic` fan-out increases MyMemory/Google request count for multi-paragraph Indic chapters.
- Memory: chapter WAV ≈ `duration × byteRate` bytes; a 20-min chapter ≈ 115 MB at 48 kHz — same as today, `Buffer.concat` of precomputed parts avoids intermediate copies.

## Validation (implementer runs these; no changes outside listed files)
1. `node --check server/src/services/audioStitcher.js` · `node --check server/src/services/ttsProvider.js` · `node --check server/src/services/textProcessor.js`
2. Scratch node REPL script (delete after): synthesize fake 48 kHz mono 16-bit WAVs (header + `Buffer.alloc(N)` PCM), call `stitch(buffers, ts, durations, 600)` with 3 chunks:
   - `merged.readUInt32LE(4) === merged.length - 8`; `merged.readUInt32LE(40) === merged.length - 44`; exactly one `RIFF` occurrence at bytes 0–3; total length = `Σdata + 44 + gapCount×57600`.
   - Silence region bytes all `0x00`; `totalDuration === Σdurations + 1.2`; timestamp entries after gap 1 shifted by `dur0 + 0.6`.
   - `silenceMs=0` output on the same inputs is **byte-identical** to pre-change `stitch` (regression check for gTTS path; compare against current implementation logic).
   - 16 kHz synthetic buffer ⇒ silence length = 19,200 bytes (derivation check).
   - Single-chapter `translateToIndic` behavior: verify paragraph rejoin by unit-testing the splitter/join path (mock network) or at minimum confirm `en-IN`/short-circuit returns pass text through with `\n\n` intact.
3. Live smoke (needs `GNANI_API_KEY`, `TTS_PROVIDER=gnani`): POST `/api/audio/synthesize` with 3-paragraph text; confirm `durationSeconds ≈ audio runtime`, file plays with audible 600 ms pauses, `alignment` startTime of paragraph 2's first sentence ≥ paragraph-1 end + 0.6 s.
4. Consumers unchanged: `rg "stitch\(" server/src` shows only `ttsProvider.js` call sites (Gnani with `silenceMs`, gTTS with default).
