# Dev A — Frontend Language Selector for Document Upload

## Goal
Add a language `<select>` to `BookUploader` (default `en-IN`) and pass the selection to the backend as `?language=` on `POST /api/documents/upload`.

## Context (verified against code)
- Upload component: `client/src/components/studio/BookUploader.jsx` (used only by `client/src/pages/Dashboard.jsx:513`). `.txt/.md` parse in-browser (no backend call); `.pdf/.epub/.docx` go to the server.
- API call: `uploadDocument(file)` in `client/src/services/api.js:55-59` — needs a `language` param.
- Backend already implements `?language=` (`server/src/routes/documentRoutes.js:113-135`): validates against `VALID_LANGUAGES` (derived from `GNANI_VOICES` languageCodes), defaults `en-IN`, 400s on invalid codes, and 400s when an Indic language is selected but the PDF yields no Indic glyphs.
- `GET /api/voices` returns `{ success, voices }` with `languageCode` per voice; `getVoices()` in `api.js:25` already exposes it.
- `client/package.json` has **no `lint` script**. Validation = `npm run typecheck` (tsc --noEmit) + `npm run build` inside `/client`.

## Decisions
- Plain `<select>` styled with the project's Tailwind tokens (matches BookUploader's existing style); do not use the Radix `ui/select.jsx` (heavier than needed for a static list).
- Language list: on mount, fetch `getVoices()` and derive unique `languageCode`s; fall back to the hardcoded 10-code list on fetch failure. Reuse the label map pattern from `VoiceSelector.jsx:5-16`.
- Selection applies only to server-parsed files (.pdf/.epub/.docx) by design; the param is simply unused for .txt/.md (parsed locally, no request sent).
- Default `en-IN` guarantees a valid value is always sent even if the user never touches the dropdown.

## Tasks
1. **`client/src/services/api.js`** — change to:
   ```js
   export function uploadDocument(file, language) {
     const form = new FormData();
     form.append('file', file);
     return api
       .post(`/api/documents/upload${language ? `?language=${encodeURIComponent(language)}` : ''}`, form)
       .then((res) => res.data);
   }
   ```
2. **`client/src/components/studio/BookUploader.jsx`**
   - Add `LANGUAGE_LABELS` const (en-IN English, hi-IN Hindi, ta-IN Tamil, te-IN Telugu, kn-IN Kannada, ml-IN Malayalam, bn-IN Bengali, gu-IN Gujarati, mr-IN Marathi, pa-IN Punjabi).
   - Add state: `const [language, setLanguage] = useState('en-IN')` and `const [languages, setLanguages] = useState(Object.keys(LANGUAGE_LABELS))`.
   - `useEffect` on mount: `getVoices().then(vs => { const codes = [...new Set(vs.map(v => v.languageCode))]; if (codes.length) setLanguages(codes); }).catch(() => {})` — silent fallback to hardcoded list.
   - Render a labeled `<select>` above the drop zone (`label className="text-sm font-medium"`, select with `rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40`), options `${LABELS[code] ?? code} (${code})`, `value={language}` / `onChange={e => setLanguage(e.target.value)}`.
   - Pass language through: `uploadDocument(file, language)` at the `.pdf/.epub` branch (line ~22). Existing error handling already surfaces the backend's 400 messages (invalid code / no-Indic-glyphs hint).
   - Small helper note under the select or drop zone: language applies to .pdf/.epub/.docx server parsing (keep copy minimal).
3. **No changes** to `Dashboard.jsx` (no new props), server, or `VoiceSelector`.

## Risks / edge cases
- User picks Indic language + English/scanned PDF → backend 400 with guidance message; BookUploader already displays it — acceptable, no extra UI.
- `/api/voices` unreachable → fallback list keeps dropdown functional; upload still works (param validated server-side regardless).
- If `getVoices()` returns codes not in `LANGUAGE_LABELS`, labels fall back to the raw code.

## Validation
1. `npm run typecheck` in `/client` (no `lint` script exists).
2. `npm run build` in `/client`.
3. Manual: select Indic language + upload Indic PDF → success; upload English PDF with Indic selected → visible 400 message; touch nothing → request carries `?language=en-IN`.

## Out of scope
- Applying language to .txt/.md client-side path, persisting last choice, auto-detect UI.
