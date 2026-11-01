# Fix Server Startup Crash — Missing GROQ_API_KEY

## Summary

`npm run dev` crashes immediately with `GroqError: The GROQ_API_KEY environment variable is missing or empty`. The `groq-sdk` client throws at module-load time (top-level `new Groq(...)`), which kills the entire process before any route can run.

Root cause: `server/.env` defines `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GNANI_*`, `TTS_PROVIDER=gtts`, etc., but **no `GROQ_API_KEY`**. Two services instantiate the client at import time:

- `server/src/services/llmDirector.js:3` — `const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });`
- `server/src/services/genreClassifier.js:3` — same pattern

Both are imported transitively by `server/src/routes/studioRoutes.js:6-7`, which is imported by `server/src/index.js:12`. Because the throw happens during ESM module evaluation, there is no try/catch that can recover — the process exits.

Note the codebase already has the pattern for deferring env access to call time: `ttsProvider.js:116` (`gnaniConfig()`) reads `process.env.GNANI_API_KEY` *inside* a function rather than at module scope, with a comment `// ponytail: env resolved per call so a missing key can't crash module load`. The Groq services do the opposite.

## Goal

Make the server start successfully with the current local configuration (gTTS as the TTS provider, no Groq key) while keeping the Groq-backed features (`spatial-preview`, genre classification) functional when a key **is** present.

## Approach

Two changes, minimal and consistent with existing code conventions:

1. **Defer Groq client construction to call time** in both services, mirroring the `gnaniConfig()` pattern. Replace the module-scope `const groq = new Groq(...)` with a lazy getter that throws a descriptive error only when an actual API call is attempted without a key. This keeps module load safe.

2. **Document the variable** by adding `GROQ_API_KEY=` (commented, with placeholder guidance) to `server/.env.example`, so future developers know the key is optional-but-required-for-LLM-features. Do **not** add it to `server/.env` — that file holds real credentials and should stay as-is.

## Files to Change

### `server/src/services/llmDirector.js`
- Remove module-scope `const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });` (line 3).
- Add a lazy accessor, e.g.:
  ```js
  let groqClient = null;
  function getGroq() {
    if (groqClient) return groqClient;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set; spatial audio director is unavailable');
    }
    groqClient = new Groq({ apiKey });
    return groqClient;
  }
  ```
- In `generateSpatialScript`, replace `groq.chat.completions.create(...)` with `getGroq().chat.completions.create(...)`. The existing `try/catch` around the call already falls back to a plain `<speak>` script on failure, so a missing key degrades gracefully at request time instead of killing the server.

### `server/src/services/genreClassifier.js`
- Same treatment: remove module-scope client, add `getGroq()` lazy accessor, use it in `classifyBookGenre`. The function already wraps the call in `try/catch` and defaults to `'General Narrative'`, so it degrades gracefully.

### `server/.env.example`
- Add a line such as:
  ```
  GROQ_API_KEY=                          # required for AI spatial-director & genre classification; optional otherwise
  ```
  Keep it commented/empty to signal "not required for basic TTS flow".

## Verification

1. `cd server && npm run dev` — server prints `Server running on port 4001` and stays up (no crash, no GroqError).
2. `curl http://localhost:4001/health` — returns `{"status":"ok"}`.
3. Confirm the gTTS synthesis path still works (it never touched Groq, so it is unaffected).
4. Confirm the LLM features degrade gracefully: calling `POST /api/studio/spatial-preview` without a key should return a valid fallback script (per the existing catch block) rather than a 500 module-load crash. With a key set, it should call Groq normally.

## Out of Scope

- Adding a real `GROQ_API_KEY` value to any committed file (credentials stay in the user's local `.env` only).
- Switching the default TTS provider or changing billing/credit logic.
- Touching BullMQ, Supabase, or storage code — those are unaffected.