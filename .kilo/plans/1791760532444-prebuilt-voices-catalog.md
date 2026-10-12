# Version 2.1 — Prebuilt Voices Catalog (DEV B / SERVER)

**Branch:** `dev-server` · **Scope:** `/server` only · **Role:** Dev B (Backend Lead)

Integrate Gnani.ai's 42 prebuilt voices as a static server-side catalog with a public
discovery endpoint. No voice cloning, no DB tables, no upload logic.

## Context (verified against code)
- **Item 4 (pipeline forwarding) is a confirmed no-op — do NOT edit these files:**
  - `server/src/services/gnaniService.js:10` `synthesizeSpeech(text, language, voice, speed)` sends `{ text, language, voice, speed }`.
  - `server/src/services/ttsProvider.js:58,118` `synthesizeWithGnani` / `synthesizeText` pass `language, voice, speed` through unchanged.
  - `server/src/routes/audioRoutes.js:253` (sync) and `:428` (async enqueue) forward `voiceProfile`. No hardcoded defaults exist.
- ESM project (`package.json` `"type": "module"`). Use `import` / `export default`.
- `index.js` CORS delegate (`index.js:26-36`): only `/api/storefront` gets wildcard `*`; **every other path already falls through to the restricted `allowedOrigin` + credentials block.** Mounting at `/api/voices` therefore inherits frontend-only CORS with **no CORS code change**.
- `index.js:42-55` `apiLimiter` = 5 req/min, currently skips `/api/storefront` and `/api/audio/synthesize-async`.

## Approved decisions
1. `GET /api/voices` is **public** (no `authMiddleware`); CORS stays restricted to `FRONTEND_URL` (no wildcard).
2. Dedicated **60 req/min** limiter on the voice router + add `/api/voices` to `apiLimiter` skip list.

## Task 1 — Create `server/src/config/gnaniVoices.js`
Static module exporting the catalog. Exact shape (verbatim):

```js
// Gnani.ai prebuilt voice catalog (v2.1). Representative entries across major
// Indian languages. Hinglish is an en-IN accent variant, matching the client's
// 'Indian English (Hinglish)' label. ids are what the client sends as
// voiceProfile -> forwarded to Gnani as `voice`.
// CAUTION: ids must match Gnani's real voice identifiers or synthesis 4xx's.

export const GNANI_VOICES = [
  // en-IN — Indian English
  { id: 'Nalini',  name: 'Nalini',     languageCode: 'en-IN', gender: 'female', accent: 'Indian English' },
  { id: 'Nitin',   name: 'Nitin',      languageCode: 'en-IN', gender: 'male',   accent: 'Indian English' },
  { id: 'Priya',   name: 'Priya',      languageCode: 'en-IN', gender: 'female', accent: 'Indian English' },
  { id: 'Arjun',   name: 'Arjun',      languageCode: 'en-IN', gender: 'male',   accent: 'Indian English' },
  // en-IN — Hinglish
  { id: 'Simran',  name: 'Simran',     languageCode: 'en-IN', gender: 'female', accent: 'Hinglish' },
  { id: 'Vikram',  name: 'Vikram',     languageCode: 'en-IN', gender: 'male',   accent: 'Hinglish' },
  // hi-IN — Hindi
  { id: 'Kaveri',  name: 'Kaveri',     languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Deepak',  name: 'Deepak',     languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Ananya',  name: 'Ananya',     languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Rohan',   name: 'Rohan',      languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Meera',   name: 'Meera',      languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  // te-IN — Telugu
  { id: 'Sneha',   name: 'Sneha',      languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Karthik', name: 'Karthik',    languageCode: 'te-IN', gender: 'male',   accent: 'Telugu' },
  { id: 'Divya',   name: 'Divya',      languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Praveen', name: 'Praveen',    languageCode: 'te-IN', gender: 'male',   accent: 'Telugu' },
  { id: 'Lakshmi', name: 'Lakshmi',    languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  // ta-IN — Tamil
  { id: 'Kavya',   name: 'Kavya',      languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Vignesh', name: 'Vignesh',    languageCode: 'ta-IN', gender: 'male',   accent: 'Tamil' },
  { id: 'Swathi',  name: 'Swathi',     languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Karthi',  name: 'Karthi',     languageCode: 'ta-IN', gender: 'male',   accent: 'Tamil' },
  // kn-IN — Kannada
  { id: 'Anusha',      name: 'Anusha',      languageCode: 'kn-IN', gender: 'female', accent: 'Kannada' },
  { id: 'Guruprasad',  name: 'Guruprasad',  languageCode: 'kn-IN', gender: 'male',   accent: 'Kannada' },
  { id: 'Harini',      name: 'Harini',      languageCode: 'kn-IN', gender: 'female', accent: 'Kannada' },
  { id: 'Manoj',       name: 'Manoj',       languageCode: 'kn-IN', gender: 'male',   accent: 'Kannada' },
  // ml-IN — Malayalam
  { id: 'Athira',   name: 'Athira',   languageCode: 'ml-IN', gender: 'female', accent: 'Malayalam' },
  { id: 'Sreenath', name: 'Sreenath', languageCode: 'ml-IN', gender: 'male',   accent: 'Malayalam' },
  { id: 'Nithya',   name: 'Nithya',   languageCode: 'ml-IN', gender: 'female', accent: 'Malayalam' },
  { id: 'Vishnu',   name: 'Vishnu',   languageCode: 'ml-IN', gender: 'male',   accent: 'Malayalam' },
  // mr-IN — Marathi
  { id: 'Sai',     name: 'Sai',     languageCode: 'mr-IN', gender: 'female', accent: 'Marathi' },
  { id: 'Aditya',  name: 'Aditya',  languageCode: 'mr-IN', gender: 'male',   accent: 'Marathi' },
  { id: 'Rutuja',  name: 'Rutuja',  languageCode: 'mr-IN', gender: 'female', accent: 'Marathi' },
  { id: 'Swapnil', name: 'Swapnil', languageCode: 'mr-IN', gender: 'male',   accent: 'Marathi' },
  // bn-IN — Bengali
  { id: 'Tiya',     name: 'Tiya',     languageCode: 'bn-IN', gender: 'female', accent: 'Bengali' },
  { id: 'Anirban',  name: 'Anirban',  languageCode: 'bn-IN', gender: 'male',   accent: 'Bengali' },
  { id: 'Meghna',   name: 'Meghna',   languageCode: 'bn-IN', gender: 'female', accent: 'Bengali' },
  { id: 'Debasish', name: 'Debasish', languageCode: 'bn-IN', gender: 'male',   accent: 'Bengali' },
  // gu-IN — Gujarati
  { id: 'Pooja',  name: 'Pooja',  languageCode: 'gu-IN', gender: 'female', accent: 'Gujarati' },
  { id: 'Hitesh', name: 'Hitesh', languageCode: 'gu-IN', gender: 'male',   accent: 'Gujarati' },
  { id: 'Nikita', name: 'Nikita', languageCode: 'gu-IN', gender: 'female', accent: 'Gujarati' },
  // pa-IN — Punjabi
  { id: 'Jasleen',  name: 'Jasleen',  languageCode: 'pa-IN', gender: 'female', accent: 'Punjabi' },
  { id: 'Harpreet', name: 'Harpreet', languageCode: 'pa-IN', gender: 'male',   accent: 'Punjabi' },
  { id: 'Manpreet', name: 'Manpreet', languageCode: 'pa-IN', gender: 'female', accent: 'Punjabi' },
];

export default GNANI_VOICES;
```
42 entries total; unique ids; 10 `languageCode` values (`en-IN, hi-IN, te-IN, ta-IN, kn-IN, ml-IN, mr-IN, bn-IN, gu-IN, pa-IN`).

## Task 2 — Create `server/src/routes/voiceRoutes.js`
Router mirroring `storefrontRoutes.js` structure (own limiter, no wildcard CORS —
wildcard is handled only for `/api/storefront` upstream, so do NOT add a per-router `cors()`).

```js
import express from 'express';
import rateLimit from 'express-rate-limit';
import { GNANI_VOICES } from '../config/gnaniVoices.js';

const router = express.Router();

const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Too many requests from this IP, please try again after a minute' },
});

// GET /api/voices — public catalog of Gnani prebuilt voices.
// Optional ?language=<langCode> filter, e.g. ?language=hi-IN.
router.get('/', voiceLimiter, (req, res) => {
  try {
    const { language } = req.query;
    const voices = language
      ? GNANI_VOICES.filter((v) => v.languageCode === language)
      : GNANI_VOICES;
    return res.json({ success: true, voices });
  } catch (error) {
    console.error('GET / error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
```
Behavior: no `language` -> all 42; valid code -> matching subset; unknown code -> `{ success: true, voices: [] }` (200, not 404 — catalog discovery should not error on empty filter).

## Task 3 — Edit `server/src/index.js`
1. Add import near the other route imports (`index.js:8-9`):
   `import voiceRouter from './routes/voiceRoutes.js';`
2. Extend the `apiLimiter` `skip` predicate (`index.js:54`) to also skip `/api/voices`:
   ```js
   skip: (req) =>
     req.path.startsWith('/api/storefront') ||
     req.path.startsWith('/api/audio/synthesize-async') ||
     req.path.startsWith('/api/voices'),
   ```
3. Mount after the storefront mount (`index.js:77`), **no auth middleware**:
   ```js
   app.use('/api/voices', voiceRouter);
   ```

Do not touch the CORS delegate. `/api/voices` inherits the restricted frontend origin automatically.

## Failure modes / risks
- **Voice ids vs Gnani real IDs (open item):** ids above are representative. The pipeline forwards `voiceProfile` verbatim to Gnani; if an id isn't recognized, Gnani returns 4xx which `isRetryableTtsFailure` correctly fails hard (no masking). Catalog is selector-only for now. Reconcile ids against Gnani's published list before GA.
- **Filter type:** `req.query.language` may arrive as array if repeated (`?language=a&language=b`). Current equality filter on a non-string yields `[]` safely — acceptable. No validation added.
- **No DB / no upload logic** introduced (per strict rules).

## Validation
- `node --check server/src/config/gnaniVoices.js`
- `node --check server/src/routes/voiceRoutes.js`
- `node --check server/src/index.js`
- `cd server && npm test` (confirm existing `ttsFallback.test.js` still green — untouched, but cheap regression guard).
- Manual: start server, `GET /api/voices` (expect 42, `success:true`), `GET /api/voices?language=hi-IN` (expect 5), `GET /api/voices?language=zz-ZZ` (expect `[]`).

## Out of scope
Client-side fetch of `/api/voices` (frontend still hardcodes `VOICES` in `AudioConfigModal.jsx:15`) — server-only ticket. No auth. No persistence.
