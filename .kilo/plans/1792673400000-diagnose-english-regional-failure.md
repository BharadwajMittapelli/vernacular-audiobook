# Diagnostic: English Text + Regional Language TTS Failure

## Objective
Isolate whether Gnani rejects English text passed with regional language codes (`te-IN`, `hi-IN`) — and verify the 502 error handling works correctly.

## Current State (confirmed from code inspection)
- **ttsProvider.js** sends: `{ text, voice, model: 'timbre-v2.5', language, speed, audio_config }` to `https://api.vachana.ai/api/v1/tts/inference`
- **Error handling** in `audioRoutes.js:312-317`: catches synthesis errors, refunds credits, marks DB row as `failed`, returns `502 Bad Gateway` with `error.message`.
- **Node process does NOT crash** on Gnani 4xx/5xx — correctly follows PROJECT_DOCUMENTATION.md §Error Boundaries.
- **gnaniService.js is dead code** — not imported by ttsProvider. Ignore it.

## Hypotheses to Test
1. **Script mismatch**: Gnani detects Latin script (English) with Devanagari/Telugu language code → 400 Bad Request.
2. **Voice-language mismatch**: English text with a Telugu-preferred voice (e.g., Suhana) → 400.
3. **Other**: Voice doesn't exist, credit balance empty, or text length exceeds limit.

## Required Tests (run before committing to fix)
Execute this script against live Gnani API:

```javascript
import { synthesizeText } from './src/services/ttsProvider.js';

const tests = [
  ['English -> te-IN', 'Hello world. This is a test.', 'te-IN'],
  ['English -> hi-IN', 'Hello world. This is a test.', 'hi-IN'],
  ['Telugu -> te-IN', 'నమస୍କారం మిత్రులారా.', 'te-IN'],
  ['Hindi -> hi-IN', 'नमस्ते दोस्तों।', 'hi-IN'],
];

for (const [label, text, lang] of tests) {
  console.log(`\n=== ${label} ===`);
  try {
    const r = await synthesizeText(text, lang, 'Suhana', 1.0);
    console.log('SUCCESS:', r.source, r.audioBuffer.length + 'B', r.totalDuration.toFixed(2) + 's');
  } catch (e) {
    console.log('FAILED:', e.message);
    if (e.httpStatus) console.log('HTTP Status:', e.httpStatus);
  }
}
```

Set `TTS_PROVIDER=gnani` and `TTS_FALLBACK_ENABLED=false` when running.

## Expected Outcomes

### If Gnani rejects English+regional (400):
- Error message will mention script mismatch or language mismatch
- Fix options:
  1. **Frontend guard**: Disable language picker for mismatched text (simplest)
  2. **Auto-detect language**: Send `language: 'auto'` and let Gnani handle it
  3. **Translation middleware**: Translate text before TTS (complex, adds latency/cost)

### If Gnani accepts English+regional (200):
- Problem is elsewhere (voice ID invalid, text processing bug, etc.)
- Check the exact error message from the test

### If 502 is NOT returned:
- Check audioRoutes.js catch block (lines 312-317)
- Verify error propagation from ttsProvider → route → response

## Implementation Steps (for code agent)
1. Run the test script above to capture actual Gnani response
2. Based on error message, choose fix path
3. If translation needed, add simple en→regional translation step before TTS
4. If frontend guard needed, add validation in VoiceSelector.jsx (out of scope per instructions)
5. Add console.log in ttsProvider.js:140 (before axios.post) and :153 (after response) for future debugging

## Validation
- English text with te-IN returns clear error (not cryptic 500)
- Credits refunded on failed synthesis
- DB row marked `failed`
- Telugu text with te-IN still succeeds (no regression)
