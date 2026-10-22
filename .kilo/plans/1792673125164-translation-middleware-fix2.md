# Translation Middleware (Fix 2) — Plan

**Date:** 2026-10-22  
**Owner:** Dev B (Backend/Server)  
**Scope:** `server/` only — no client edits.

## Problem

Gnani.ai's regional Indic models (`te-IN`, `hi-IN`, etc.) reject Latin/English characters with a hard 400 Bad Request. The demo fails immediately for non-English voices when the input is English text. We must translate the input text into the native Indic script *before* the TTS payload is assembled.

## Goal

Introduce a free, zero-auth translation step that runs inside the server TTS pipeline so:
1. Gnani receives Indic-script input and accepts it.
2. gTTS receives the translated text (still works; it handles Indic).
3. Alignment and chunking all operate on the *translated* text so timestamps match the audio output.
4. Credits are billed on the original text length (client parity preserved).

## Decisions Locked

| Decision | Answer |
|---|---|
| Hook point | **Top of `synthesizeText()`** in `ttsProvider.js`. Covers sync route + async worker + gTTS runtime fallback in one place. |
| Translation library | `@vitalets/google-translate-api` (free, unmetered Google Translate mirror; uses native `fetch`). |
| Fallback library | `@myMemory` direct GET to `https://api.mymemory.translated.net/get`. Zero auth. |
| Failure policy | Google → retry x2 with exponential backoff (1s, 2s) → MyMemory → hard fail (throw) → route/worker refund + 502. |
| Credit billing | Remains on the **original** `cleanText.length` (unchanged). Client-side `CreditEstimateBadge` parity holds. |
| Audio audit | Passes the **original** `cleanText` as before (unchanged). |
| Chunk boundary regex | Must include native Indic punctuation `।` (Devanagari/Telugu/Kannada danda) alongside ASCII `.` `!` `?`. |

## Files to Touch

1. `server/package.json` — add dependency.
2. `server/src/services/textProcessor.js` — new `translateToIndic()` + updated chunking regex.
3. `server/src/services/ttsProvider.js` — import new helper, await translation at top of `synthesizeText()`.
4. `server/src/services/alignmentCalculator.js` — regex split to recognize `।`.
5. `server/src/queues/synthesisQueue.js` — no changes (calls same chokepoint).

## Step-by-step Changes

### Step 1 — Install dependency

```
cd server && npm install @vitalets/google-translate-api
```

(No auth key needed — free endpoint. Rate-limit is generous for hackathon MVP; handled via retries.)

### Step 2 — `server/src/services/textProcessor.js`

**New function:**

```js
export const INDIC_LANG_CODES = ['hi', 'te', 'ta', 'kn'];

const GNANI_LOCALE_TO_ISO = {
  'hi-IN': 'hi',
  'te-IN': 'te',
  'ta-IN': 'ta',
  'kn-IN': 'kn',
};

// Max safe payload for Google Translate free endpoint per request (soft limit ~5k).
const GOOGLE_MAX_CHARS = 1500;
// MyMemory anonymous PUT limit is 500 chars per request.
const MYMEMORY_MAX_CHARS = 480;
// Sentence-splitter that recognizes ASCII AND Indic danda boundaries.
const SENTENCE_SPLITTER = /(?<=[.!?।])\s*/;

/**
 * Translate English (or any Latin-script) text into native Indic script.
 * Returns the original text verbatim when the target is not an Indic locale.
 *
 * Pipeline: Google Translate (retry x2) → MyMemory (best-effort) → throw on both fail.
 */
export async function translateToIndic(text, targetLangCode) {
  if (!targetLangCode || targetLangCode === 'en-IN') return text;

  const isoCode = GNANI_LOCALE_TO_ISO[targetLangCode];
  if (!isoCode || !INDIC_LANG_CODES.includes(isoCode)) return text;

  if (!text || text.trim().length === 0) return text;

  // Quick short-circuit: if text already contains Indic script, skip translation.
  if (/[\u0900-\u097F\u0C00-\u0C7F]/.test(text)) return text;

  const translateWithGoogle = async (chunk) => {
    const mod = await import('@vitalets/google-translate-api');
    const translate = mod.translate;
    const res = await translate(chunk, { from: 'en', to: isoCode });
    return res.text;
  };

  const translateWithMyMemory = async (chunk) => {
    const enc = encodeURIComponent(chunk);
    const url = `https://api.mymemory.translated.net/get?q=${enc}&langpair=en|${isoCode}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const json = await res.json();
    if (!json.responseStatus || json.responseStatus !== 200) {
      throw new Error(`MyMemory error: ${json.responseDetails || json.responseStatus}`);
    }
    return json.responseData?.translatedText || chunk;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Chunk the input so no single request exceeds limits.
  const chunks = text.split(SENTENCE_SPLITTER).filter(Boolean);
  const translatedChunks = [];

  for (const chunk of chunks) {
    // Choose max chunk size based on which provider will be tried first.
    let googleChunk = chunk;
    let mmChunk = chunk;

    // Split further if needed.
    while (googleChunk.length > GOOGLE_MAX_CHARS) {
      translatedChunks.push(googleChunk.slice(0, GOOGLE_MAX_CHARS));
      googleChunk = googleChunk.slice(GOOGLE_MAX_CHARS);
    }
    translatedChunks.push(googleChunk);

    const parts = [];
    while (mmChunk.length > MYMEMORY_MAX_CHARS) {
      parts.push(mmChunk.slice(0, MYMEMORY_MAX_CHARS));
      mmChunk = mmChunk.slice(MYMEMORY_MAX_CHARS);
    }
    parts.push(mmChunk);
    // (We'll reconstruct the same chunk boundaries for MyMemory below.)
  }

  // Sequential retry-first then fallback approach per original text.
  // Re-chunk at the sentence level for each provider call.
  const retryGoogle = async (retryMax = 2) => {
    const results = [];
    for (let i = 0; i < translatedChunks.length; i++) {
      let lastErr;
      for (let attempt = 0; attempt <= retryMax; attempt++) {
        try {
          const t = await translateWithGoogle(translatedChunks[i]);
          results.push(t);
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < retryMax) await sleep(1000 * 2 ** attempt);
        }
      }
      if (results.length <= i) {
        // All retries exhausted — fall through to MyMemory.
        throw lastErr;
      }
    }
    return results.join(' ');
  };

  const fallbackMyMemory = async () => {
    const results = [];
    for (const chunk of translatedChunks) {
      let lastErr;
      // MyMemory also benefits from splitting because of its 500-char PUT limit.
      const subParts = [];
      let rest = chunk;
      while (rest.length > MYMEMORY_MAX_CHARS) {
        subParts.push(rest.slice(0, MYMEMORY_MAX_CHARS));
        rest = rest.slice(MYMEMORY_MAX_CHARS);
      }
      subParts.push(rest);
      for (const part of subParts) {
        try {
          const t = await translateWithMyMemory(part);
          results.push(t);
        } catch (err) {
          lastErr = err;
          // Continue — partial failures degrade gracefully to original chunk.
        }
      }
    }
    if (!results.length) throw lastErr || new Error('MyMemory returned no results');
    return results.join(' ');
  };

  try {
    return await retryGoogle();
  } catch {
    console.warn('[translateToIndic] Google failed, falling back to MyMemory');
    return await fallbackMyMemory();
  }
}

// Updated chunkText — recognize native danda (।) as a sentence boundary.
export function chunkText(text) {
  const cleanText = stripMarkdown(text);
  const chunks = [];
  let currentChunk = '';

  // New split that includes Indic danda alongside ASCII terminal punctuation.
  const sentences = cleanText.split(SENTENCE_SPLITTER);

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    if (currentChunk.length + sentence.length + 1 <= CHUNK_MAX_CHARS) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (sentence.length > CHUNK_MAX_CHARS) {
        const words = sentence.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= CHUNK_MAX_CHARS) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        if (wordChunk) currentChunk = wordChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// calculateCredits is intentionally left unchanged (must stay on original length).
export function calculateCredits(text) {
  const cleanText = stripMarkdown(text);
  return Math.ceil(cleanText.length / 100);
}
```

### Step 3 — `server/src/services/ttsProvider.js`

Add one import at the top, and translate at the top of `synthesizeText`:

```js
import { chunkText, translateToIndic } from './textProcessor.js';

// ...

export async function synthesizeText(text, language, voice, speed = 1.0) {
  // ★ NEW: translate to native Indic script BEFORE any provider logic.
  const translatedText = await translateToIndic(text, language);

  const provider = process.env.TTS_PROVIDER || 'gtts';

  if (provider === 'gnani' && (process.env.GNANI_API_KEY || process.env.GNANI_API_KEY_ID)) {
    try {
      return await synthesizeWithGnani(translatedText, language, voice, speed);
    } catch (err) {
      if (process.env.TTS_FALLBACK_ENABLED === 'false' || !isRetryableTtsFailure(err)) throw err;
      console.warn(`[TTS] Primary provider failed, falling back to gTTS: ${err.message}`);
      return await synthesizeWithGtts(translatedText, language, voice, speed);
    }
  }

  return await synthesizeWithGtts(translatedText, language, voice, speed);
}
```

**Important notes:**
- `textProcessor` is now imported by `ttsProvider`. `audioRoutes.js` already imports `chunkText` from `textProcessor`; leave that import untouched.
- Credits stay on the *original* `text` (already computed upstream in both the sync route and async worker), so no billing changes are needed.
- `auditAudio` stays on the original `cleanText` per its existing contract.

### Step 4 — `server/src/services/alignmentCalculator.js`

Update the split regex to include `।`:

```js
function splitIntoSentences(text) {
  return text
    .replace(/[#*`_\[\]]/g, '')
    .split(/(?<=[.!?।])\s+/)
    .filter(s => s.trim().length > 0);
}
```

(Chunking regex already covered by Step 2's `chunkText` update.)

## Data-flow (post-change)

```
POST /api/audio/synthesize  ──►  stripMarkdown(text) = cleanText (for credits)
                                     │
                                     ▼
                                synthesizeText(cleanText, language, ...)
                                     │
                                     ▼  translateToIndic()
                               translatedText
                                     │
                              ┌──────┴──────┐
                              │             │
                     synthesizeWithGnani  synthesizeWithGtts
                              │             │
                              ▼             ▼
                         chunkText(translatedText)   — now splits on [.!?।]
                              │
                              ▼
                         calculateAlignment(translatedText, ...)
                              │
                              ▼
                         upload / store / return
```

Same flow for `POST /api/audio/synthesize-async` because the worker calls the same `synthesizeText()`.

## Rollout / Migration

Zero breaking change. Unmapped languages (e.g., future `mr-IN`) pass through untranslated — no regressions.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Free Google Translate rate-limits the app | Retries + exponential backoff; secondary MyMemory fallback; throws after exhaustion so credits are refunded. |
| Translation hallucination or wrong script | Forcing `from: 'en'` keeps output predictable; auto-detect is NOT used so mis-detected source doesn't break things. |
| MyMemory daily limit hit | Falls back to original text; original English text still works for the gTTS fallback path (demo survives even if degraded). |
| Large chapter > tens of KB | Chunking at sentence boundaries keeps each request under limits. |
| Alignment mismatch between translated and chunked output | Both use the same translated text; chunk boundaries align with `।`/`.`, matching the alignment splitter. |

## Validation Steps

Run after implementing:

1. `cd server && npm install @vitalets/google-translate-api`
2. Start server: `npm run dev`
3. Hit the sync route with English text + `te-IN` voice → expect `audioUrl` and no 400 from Gnani.
4. Hit the sync route with English text + `hi-IN` voice → same.
5. Hit with `en-IN` voice → translation bypasses, audio synthesizes as before.
6. Hit with an unmapped language (e.g., `sr-IN`) → translation bypasses, audio synthesizes as before.
7. Interrupt a translation (kill DNS or simulate rate-limit) → route should return 502, credits refunded.
8. Async book upload (`synthesize-async`) with 3 chapters in Hindi → all three synthesize without 400s.
9. Inspect `alignment[].text` — values are in the translated Indic script, matching the spoken audio.

## Open / Known Limitations

- **Translation quality** is limited to free Google Translate — acceptable for hackathon demos, not production.
- **MyMemory** has a strict 500-char per request limit and anonymous daily caps. Falls back to original text if both fail entirely.
- **Credits are on original text length** — fine, but means the client sees the estimate before translation; translated length could be longer/shorter. Future: recalc estimate after translation if parity matters.
- **No caching** of translations — identical English inputs will translate again on each request. Acceptable for MVP.
- **gTTS path now always receives translated text**, even if the user picked an English voice — no harm, but the audio is of the translated text if a non-English voice was requested.
