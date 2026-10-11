# Phase 4 Sprint 4.3 (DEV B / Server): Audio Quality Audit

**Branch:** `dev-server` · **Scope:** `/server` only · **Role:** Dev B (Backend Lead)

## Goal
Prevent corrupted/truncated audio from being uploaded to CDN and billed. Fast in-memory binary+heuristic audit inserted between `synthesizeText` and `uploadAudio` in both sync and async paths.

---

## Files to Create / Modify

### 1. NEW `server/src/services/audioAuditService.js`
```javascript
export class AudioAuditError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AudioAuditError';
  }
}

/**
 * Hard-gate validation before upload. Throws AudioAuditError on failure.
 * Three checks: size, auto-detected magic bytes, duration-vs-text ratio.
 */
export function auditAudio(buffer, text, durationSeconds) {
  // Check 1: minimum buffer size
  if (!buffer || buffer.length < 500) {
    throw new AudioAuditError('Audio buffer too small (< 500 bytes)');
  }

  // Check 2: Auto-detect Magic bytes
  const isWav = buffer.slice(0, 4).toString('utf8') === 'RIFF';
  const isId3 = buffer.slice(0, 3).toString('utf8') === 'ID3';
  const isMpegSync = buffer[0] === 0xff && (buffer[1] & 0b11100000) === 0b11100000;

  if (!isWav && !isId3 && !isMpegSync) {
    throw new AudioAuditError('Invalid audio buffer: missing WAV, ID3, or MPEG sync magic bytes');
  }

  // Check 3: duration vs text length ratio
  const expectedMinDuration = text.length / 20;
  const threshold = expectedMinDuration * 0.2;
  if (durationSeconds < threshold && threshold > 0) {
    throw new AudioAuditError(
      `Audio duration anomalously short: ${durationSeconds}s vs expected min ${threshold.toFixed(1)}s for ${text.length} chars`
    );
  }
}
```

### 2. EDIT `server/src/routes/audioRoutes.js`
Insert audit call between synthesis result and uploadAudio (line ~213, after `alignment = result.alignment`).

Import line: add `import { auditAudio } from '../services/audioAuditService.js';`

After `alignment = result.alignment;`, insert:
```javascript
        // ponytail: hard-gate prevents corrupted TTS output from reaching CDN
        auditAudio(result.audioBuffer, cleanText, totalDuration);
```

No format parameter — auto-detection from magic bytes handles both gTTS (MP3) and Gnani (WAV) paths.

The existing catch block (line ~230) already handles any thrown error — refund credits + mark failed. No other changes needed.

### 3. EDIT `server/src/queues/synthesisQueue.js`
Same insertion in `synthesizeChapterWorker`, between `alignment = result.alignment` (line ~126) and `uploadAudio` (line ~129).

Import line: add `import { auditAudio } from '../services/audioAuditService.js';`

After `alignment = result.alignment;`, insert:
```javascript
        // ponytail: hard-gate prevents corrupted TTS output from reaching CDN
        auditAudio(result.audioBuffer, cleanText, totalDuration);
```

Same catch block (line ~160) handles the error identically — refund + mark failed + `mark_book_failed` if book.

---

## Execution Order

1. Create `server/src/services/audioAuditService.js`
2. Edit `audioRoutes.js` — add import + insert audit call after synthesis
3. Edit `synthesisQueue.js` — add import + insert audit call after synthesis
4. Run `node --check` on all modified files
5. Run `npm run lint`

---

## Validation

| Check | Action | Pass Criteria |
|-------|--------|---------------|
| Lint | `npm run lint` in `/server` | Zero errors |
| Syntax | `node --check src/index.js` | No errors |
| Sync happy path | POST synthesize with valid text | 200, audio uploaded |
| Sync empty buffer | Mock `synthesizeText` to return <500 byte buffer | 502, credits refunded, row `status='failed'` |
| Sync short duration | Return duration=0.01 for 500-char text | 502, credits refunded, row `status='failed'` |
| Async happy path | POST synthesize-async with valid text | 202, chapters complete in DB |
| Async audit fail | Any chapter returns bad buffer | Chapter `status='failed'`, book `status='failed'`, credits refunded |
| Sync unchanged | POST synthesize still works | Same response shape as before |

---

## Risks / Known Gaps
- **Magic byte heuristic** — valid MP3s with ID3 tags or MPEG sync frames pass. Edge case: some valid MP3s may fail if they have neither. Extremely rare with gTTS output.
- **Duration threshold is loose (20%)** — allows very slow speech. Tighten if production feedback shows false positives.
- **No DB migration needed** — audit is pure in-memory logic.

---

## Out of Scope
- Streaming progressive audit (not needed — buffers are in-memory).
- Real-time quality scoring (ML-based).
- Audit logging to database (not required for MVP).
