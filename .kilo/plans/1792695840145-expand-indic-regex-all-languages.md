# DEV B — Expand INDIC_RE + translation targets (approved 2026-10-22T19:07Z)

## Approved scope

1. `INDIC_RE` → `/[\u0900-\u0D7F]/` in `documentRoutes.js`.
2. Same expansion for the inline short-circuit regex in `textProcessor.js`.
3. `INDIC_LANG_CODES` → `['hi','te','ta','kn','ml','mr','pa','bn','gu']`.
4. **Added by this plan (required for directive #3 to have any effect):** expand `GNANI_LOCALE_TO_ISO` with the five new locale mappings. See "Contradiction found" below.

## Contradiction found in the approved directive

The directive states expanding `INDIC_LANG_CODES` (line 3 of `textProcessor.js`) "fixes the translation pipeline for the new languages". Verified against code: `translateToIndic` resolves the ISO code via `GNANI_LOCALE_TO_ISO[targetLangCode]` (line 23), a hardcoded map containing only `hi-IN`, `te-IN`, `ta-IN`, `kn-IN` (lines 5–10). For `ml-IN`/`mr-IN`/`bn-IN`/`gu-IN`/`pa-IN` the lookup is `undefined` and line 24 returns the text **before** `INDIC_LANG_CODES.includes(...)` is ever evaluated. The array expansion alone is dead code for the new languages.

`GNANI_LOCALE_TO_ISO` must gain `'ml-IN':'ml', 'mr-IN':'mr', 'bn-IN':'bn', 'gu-IN':'gu', 'pa-IN':'pa'` for translation to fire. These ISO codes are gTTS-valid (`server/src/services/ttsProvider.js:2-4`: "Google itself accepts all our language codes"). Executing per directive without this addition would report the pipeline fixed while only the regex behavior changed.

`hi-en` (Hinglish, present in `VALID_LANGUAGES`) stays unmapped → translation skipped, text passed through unchanged. Intentional; out of scope.

## Problem

`INDIC_RE = /[\u0900-\u097F\u0C00-\u0C7F]/` matches only Devanagari (U+0900–U+097F) and Telugu (U+0C00–U+0C7F). PDFs in Malayalam, Gujarati, Bengali, Punjabi, Tamil, or Kannada pass the `language !== 'en-IN' && !INDIC_RE.test(raw)` guard at `server/src/routes/documentRoutes.js:130` as "no Indic characters" and are rejected with a 400, even though those languages exist in `VALID_LANGUAGES`.

## Verified codebase state (2026-10-22)

- `server/src/routes/documentRoutes.js:12` — `const INDIC_RE = /[\u0900-\u097F\u0C00-\u0C7F]/;` (used only at line 130).
- `server/src/services/textProcessor.js:29` — identical inline literal inside `translateToIndic()` short-circuit: `if (/[\u0900-\u097F\u0C00-\u0C7F]/.test(text)) return text;`. Same bug class, in the task's `/server/src` scope: already-translated Malayalam/Gujarati/Bengali text would be needlessly re-translated. Include in fix.
- No other occurrences of the narrow ranges anywhere in `server/src` (grep confirmed).
- `textProcessor.js:3` — `INDIC_LANG_CODES = ['hi', 'te', 'ta', 'kn']`; `textProcessor.js:5-10` — `GNANI_LOCALE_TO_ISO` maps only those four locales (see Contradiction section).
- Branch `master` at `40a52b6`, clean tree except untracked plan files.

## Unicode coverage of `[\u0900-\u0D7F]`

Contiguous range; the only blocks inside it are Indic scripts (plus reserved/unassigned gaps that no real PDF text hits). Sinhala starts at U+0D80, safely outside. No non-Indic script can match.

| Range | Script | Covered language codes |
|---|---|---|
| U+0900–U+097F | Devanagari | hi-IN, mr-IN |
| U+0980–U+09FF | Bengali | bn-IN |
| U+0A00–U+0A7F | Gurmukhi | pa-IN |
| U+0A80–U+0AFF | Gujarati | gu-IN |
| U+0B00–U+0B7F | Odia | (not served; harmless) |
| U+0B80–U+0BFF | Tamil | ta-IN |
| U+0C00–U+0C7F | Telugu | te-IN |
| U+0C80–U+0CFF | Kannada | kn-IN |
| U+0D00–U+0D7F | Malayalam | ml-IN |

Both Tamil (U+0B80–U+0BFF) and Malayalam (U+0D00–U+0D7F) are inside the range; the next block after U+0D7F is Sinhala (U+0D80+), which is excluded.

## Implementation

Work on `master` in `server/src`. Four edits, all in two files.

### Step 1 — `server/src/routes/documentRoutes.js:12`

```js
const INDIC_RE = /[\u0900-\u0D7F]/;
```

### Step 2 — `server/src/services/textProcessor.js:29`

```js
if (/[\u0900-\u0D7F]/.test(text)) return text;
```

(Do not de-duplicate into a shared util; one-line literal edits match repo style.)

### Step 3 — `server/src/services/textProcessor.js:3`

```js
const INDIC_LANG_CODES = ['hi', 'te', 'ta', 'kn', 'ml', 'mr', 'pa', 'bn', 'gu'];
```

### Step 4 — `server/src/services/textProcessor.js:5-10`

```js
const GNANI_LOCALE_TO_ISO = {
  'hi-IN': 'hi',
  'te-IN': 'te',
  'ta-IN': 'ta',
  'kn-IN': 'kn',
  'ml-IN': 'ml',
  'mr-IN': 'mr',
  'bn-IN': 'bn',
  'gu-IN': 'gu',
  'pa-IN': 'pa',
};
```

### Step 5 — Syntax check

```
node --check server/src/routes/documentRoutes.js
node --check server/src/services/textProcessor.js
```

### Step 6 — Behavioral check (ASCII-only source; avoids Windows cmd codepage corruption)

Old regex must FAIL each new script; new regex must PASS every Indic block; both must reject Latin:

```
node -e "const P=[[0x0939,'deva'],[0x09AC,'beng'],[0x0A2A,'guru'],[0x0A97,'gujr'],[0x0B15,'orya'],[0x0B95,'taml'],[0x0C15,'telu'],[0x0C95,'kann'],[0x0D15,'mala'],[0x0041,'latin']];const N=/[\u0900-\u0D7F]/,O=/[\u0900-\u097F\u0C00-\u0C7F]/;for(const[c,n]of P){const s=String.fromCodePoint(c);console.log(n,'new='+N.test(s),'old='+O.test(s))}"
```

Expected:

```
deva new=true old=true
beng new=true old=false
guru new=true old=false
gujr new=true old=false
orya new=true old=false
taml new=true old=true
telu new=true old=true
kann new=true old=false
mala new=true old=false
latin new=false old=false
```

Any `new=false` on an Indic row, or `new=true` on `latin`, fails the task.

## Out of scope

- `hi-en` (Hinglish) translation mapping — left unmapped on purpose (see Contradiction section).
- Client-side code, `VALID_LANGUAGES` derivation, audio routes, provider selection.
- Committing — only if explicitly requested by the orchestrator after validation.

## Risks

- Regex expansion: none material. Pure character-class widening; guard logic and error messages unchanged. English PDFs with an Indic `?language` still correctly 400.
- Steps 3+4 change runtime behavior: English ingested text in the five new languages will now be translated (Google Translate → MyMemory fallback) before synthesis instead of passed through. This is the directive's stated intent, not a regression. Failure handling is unchanged — per-chunk failures keep the original text (`textProcessor.js:105`).
- MyMemory has harsher rate limits than Google for low-resource langs (ml/pa); existing per-chunk fallback warning path covers it, no new code needed.

## Validation

1. Both `node --check` commands pass.
2. Step 6 output matches the expected table exactly.
3. Upload a Malayalam PDF with `?language=ml-IN` → 200, no INDIC_RE 400.
4. Upload Gujarati (`gu-IN`) and Bengali (`bn-IN`) PDFs → 200.
5. Regression: Hindi (`hi-IN`) and Telugu (`te-IN`) PDFs still succeed; English PDF with `?language=hi-IN` still returns the guidance 400; English PDF with no/`en-IN` language unaffected.
6. If a live server is available: synthesize short English text with `language=ml-IN` and confirm output audio path exercises `translateToIndic` (log/word-check), proving Steps 3–4 took effect.
