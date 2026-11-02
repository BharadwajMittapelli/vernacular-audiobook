# Spatial Audio Engine Upgrade — Implementation Plan

## Goal
Upgrade the Spatial Audio Engine to produce realistic acoustic output by:
1. **SSML Injection**: Integrate Groq SDK (Qwen model) to generate a "voice director" script wrapping text in strict SSML tags (`<speak>`, `<break>`, `<prosody>`, `<emphasis>`) for natural breaths, pauses, and emotional pitch shifts.
2. **Acoustic DSP Upgrade**: Replace hard FFmpeg panning with acoustic crossfeed and apply robust frequency masking (highpass + lowpass) to ambient tracks for environmental rumble.

## Files to Modify
| File | Action |
|------|--------|
| `server/src/services/llmDirector.js` | **Rewrite** — Groq + SSML system prompt, robust error handling with fallback |
| `server/src/routes/studioRoutes.js` | **Modify** — SSML sanitizer + per-break synthesis + crossfeed DSP + low-pass ambient |

---

## Part 1: `server/src/services/llmDirector.js` — Full Rewrite

### Changes
1. **Keep Groq client init** (already migrated):
   ```js
   import Groq from 'groq-sdk';
   const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
   const MODEL = process.env.GROQ_DIRECTOR_MODEL || 'qwen/qwen3.8-27b';  // already Qwen
   ```

2. **System prompt** — AI Audio Director outputting strict JSON with three tracks (`main`, `sidekick`, `ambient`), each containing:
   - `text`: SSML-wrapped string (only `<speak>`, `<break time="...">`, `<prosody rate="..." pitch="...">`, `<emphasis level="...">`)
   - `voice`: per track (Pranav / Kaveri / Deepak)
   - `language`: per track (en-IN / en-IN / hi-IN)

3. **Track-specific guidelines in prompt**:
   - `main`: Core narrative with natural `<break>` for breaths; `<prosody>` for emotional shifts
   - `sidekick`: 2–3 word reactions, genre-adjusted (tense whisper for Thriller, excited pitch for Folklore); `<emphasis>` for urgency
   - `ambient`: Phonetic strings inside `<speak>` (e.g., `<speak>shhhhh click click whoosh</speak>`)

4. **API call**: `response_format: { type: 'json_object' }`, `temperature: 0.3`, `max_tokens: 16000`

5. **Robust error handling**:
   - Wrap in try/catch
   - On failure: log error, return graceful fallback object with **only `main` track** containing basic SSML wrap:
     ```js
     { main: { text: `<speak>${chapterText}</speak>`, voice: 'Pranav', language: 'en-IN' } }
     ```
   - This prevents pipeline crashes downstream

---

## Part 2: `server/src/routes/studioRoutes.js` — SSML Sanitizer + Per-Break Synthesis + DSP

### A. SSML Sanitizer & Per-Break Synthesis (inline in route, before FFmpeg)

```js
import { buildSilenceBuffer } from '../services/audioStitcher.js';

// 1. Split sanitized SSML text into alternating [segment, breakMs, segment, breakMs, ...]
function parseSsmlBreaks(ssmlText) {
  const parts = [];
  let currentText = ssmlText;
  const breakRegex = /<break\s+time\s*=\s*["'](\d+)ms["']\s*\/?>/gi;
  let match;
  let lastIndex = 0;

  while ((match = breakRegex.exec(currentText)) !== null) {
    const beforeBreak = currentText.slice(lastIndex, match.index).trim();
    if (beforeBreak) parts.push({ type: 'text', value: beforeBreak });
    parts.push({ type: 'break', value: parseInt(match[1], 10) });
    lastIndex = breakRegex.lastIndex;
  }
  const afterLast = currentText.slice(lastIndex).trim();
  if (afterLast) parts.push({ type: 'text', value: afterLast });

  // Also strip all other SSML tags (<speak>, <prosody>, <emphasis>) from text segments
  return parts.map(p => p.type === 'text'
    ? { ...p, value: p.value.replace(/<\/?(speak|prosody|emphasis)[^>]*>/gi, '') }
    : p);
}

// 2. Concurrent synthesis preserving order
async function synthesizeWithBreaks(ssmlText, language, voice) {
  const parts = parseSsmlBreaks(ssmlText);
  const textSegments = parts.filter(p => p.type === 'text').map(p => p.value);

  // Synthesize all text segments in parallel
  const segmentBuffers = await Promise.all(
    textSegments.map((seg, idx) => synthesizeText(seg, language, voice))
      .map(p => p.then(r => r.audioBuffer))
  );

  // 3. Interleave audio + silence using buildSilenceBuffer
  // Hardcoded byteRate = 32000 (16kHz, 16-bit mono) per audioStitcher convention
  const byteRate = 32000;
  let segIdx = 0;
  const mergedParts = [];

  for (const part of parts) {
    if (part.type === 'text') {
      mergedParts.push(segmentBuffers[segIdx++]);
    } else {
      const silence = buildSilenceBuffer(part.value, byteRate);
      mergedParts.push(silence);
    }
  }

  return Buffer.concat(mergedParts);
}
```

### B. Updated Track Synthesis in Route

Replace the `Promise.allSettled` block (lines 119–127) to use `synthesizeWithBreaks` for the **main** track (which carries SSML). For sidekick/ambient, strip all SSML tags before passing to `synthesizeText` since they carry phonetic strings and short reactions that shouldn't have tags read aloud.

```js
// Main track: SSML-aware synthesis with per-break pauses
const mainBuf = await synthesizeWithBreaks(script.main.text, script.main.language, script.main.voice);
const mainPath = resolve(tmpdir(), `main_${randomUUID()}.wav`);
await writeFile(mainPath, mainBuf);
tempPaths.push(mainPath);

// Sidekick & ambient: simple synthesis — strip all XML/HTML tags first
const otherTracks = [
  ...(script.sidekick?.text ? [{ ...script.sidekick, label: 'sec' }] : []),
  ...(script.ambient?.text ? [{ ...script.ambient, label: 'amb' }] : []),
];

const otherPaths = await Promise.all(
  otherTracks.map(async (t) => {
    // Strip all tags (<speak>, <prosody>, etc.) before sending to TTS
    const cleanText = t.text.replace(/<[^>]*>/g, '');
    const buf = (await synthesizeText(cleanText, t.language, t.voice)).audioBuffer;
    const p = resolve(tmpdir(), `${t.label}_${randomUUID()}.wav`);
    await writeFile(p, buf);
    tempPaths.push(p);
    return { path: p, label: t.label };
  })
);

const sidekickPath = otherPaths.find(x => x.label === 'sec')?.path ?? null;
const ambientPath = otherPaths.find(x => x.label === 'amb')?.path ?? null;
```

### C. Acoustic Crossfeed DSP (replace lines 165–175)

**Main** (track 0): Slight crossfeed for natural width — narrator centered with bleed
```
[0:a]volume=1.0,pan=stereo|c0=0.8*c0|c1=0.8*c0[main]
```
Note: `c0*c0` syntax references input channel for proper mix computation in FFmpeg pan filter.

**Sidekick** (track 1): Hard-right with left-ear bleed (crossfeed ~0.2) for spatial separation
```
[1:a]volume=0.45,pan=stereo|c0=0.2*c0|c1=0.8*c0[sidekick]
```

**Ambient** (track 2): Robust frequency masking for TTS-generated environmental noise
```
[2:a]volume=0.15,highpass=f=100,lowpass=f=500,aecho=0.8:0.9:1000:0.3[bg]
```
- `highpass=f=100`: Strips sub-bass mud that clashes with narrator
- `lowpass=f=500`: Muffles TTS articulation → pure rumble
- `aecho`: Spatial room wash via diffuse echo

Replace the filter builder (lines 157–183) with:

```js
let inputCount = 0;
const filters = [];

ffmpegProcess.input(mainPath);
filters.push(`[${inputCount}:a]volume=1.0,pan=stereo|c0=0.8*c0|c1=0.8*c0[main]`);
inputCount++;

if (sidekickPath) {
  ffmpegProcess.input(sidekickPath);
  filters.push(`[${inputCount}:a]volume=0.45,pan=stereo|c0=0.2*c0|c1=0.8*c0[sidekick]`);
  inputCount++;
}

if (ambientPath) {
  ffmpegProcess.input(ambientPath);
  // Robust frequency masking: highpass + lowpass band-pass + echo wash
  filters.push(`[${inputCount}:a]volume=0.15,highpass=f=100,lowpass=f=500,aecho=0.8:0.9:1000:0.3[bg]`);
  inputCount++;
}

if (inputCount > 1) {
  const trackLabels = ['main'];
  if (sidekickPath) trackLabels.push('sidekick');
  if (ambientPath) trackLabels.push('bg');
  const inputsString = trackLabels.map((l) => `[${l}]`).join('');
  filters.push(`${inputsString}amix=inputs=${inputCount}:duration=first:dropout_transition=2[out]`);
}
```

---

## Validation Steps

```bash
# Syntax checks
node --check server/src/services/llmDirector.js
node --check server/src/routes/studioRoutes.js

# Runtime test (requires GROQ_API_KEY in server/.env)
cd server && npm test  # if tests exist, otherwise manual curl to /spatial-preview
```

---

## Edge Cases & Fallbacks

| Scenario | Behavior |
|----------|----------|
| Groq API failure / malformed JSON | Fallback `main` track only (basic SSML wrap) — no crash |
| `synthesizeWithBreaks` error on main track | Catch, log, fall back to single `synthesizeText` call |
| No `<break>` tags in main SSML | `parseSsmlBreaks` returns single text segment; synthesis works normally |
| Sidekick/ambient missing | DSP chain adapts (amix inputs = 1, 2, or 3) |
| `GROQ_API_KEY` missing | `llmDirector.js` throws on init — must be configured |

---

## Notes
- **Model**: `qwen/qwen3.8-27b` via `GROQ_DIRECTOR_MODEL` env var
- **SSML interpretation**: Sanitizer parses `<break>` tags, strips all tags, synthesizes segments separately, interleaves with `buildSilenceBuffer` for precise pauses
- **Byte rate**: Hardcoded to 32000 (16kHz × 16-bit mono) as per audioStitcher.js convention
- **Pan filter syntax**: Uses `c0*0.8*c0` for proper input-channel referencing in FFmpeg
- **Band-pass EQ for ambient**: `highpass=f=100` removes sub-bass mud; `lowpass=f=500` mutes TTS articulation → environmental rumble
- **Per-break durations**: Extracted via regex, synthesized in parallel, interleaved with precise silence
- **amix duration=first**: Ensures ambient tail stops when narrator ends

---

## Execution Order
1. Rewrite `server/src/services/llmDirector.js` — replace Gemini client with Groq, update prompt for SSML output, add error handling with fallback
2. Add `parseSsmlBreaks` + `synthesizeWithBreaks` helpers inline in `POST /spatial-preview` in `studioRoutes.js`
3. Replace main-track synthesis with `synthesizeWithBreaks` call
4. Strip XML tags from sidekick/ambient before `synthesizeText`
5. Replace FFmpeg filter builder for crossfeed DSP + robust frequency masking on ambient
6. Validate syntax: `node --check` on both files
7. Manual test with `curl -X POST /spatial-preview` using a sample chapter

---

## Final Deliverables
- `server/src/services/llmDirector.js` — Groq + SSML system prompt + error fallback
- `server/src/routes/studioRoutes.js` — SSML sanitizer, per-break synthesis, crossfeed DSP, robust band-pass EQ on ambient