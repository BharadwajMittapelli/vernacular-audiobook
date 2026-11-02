# Phase 4: Context Locking & UI Staging

## Goal
Make the Spatial Audio Engine context-aware by:
1. Classifying book genre on creation via Gemini
2. Passing genre profile to the LLM Director for atmospheric synthesis
3. Adding a UI toggle in Studio to enable/disable spatial synthesis

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `server/src/services/genreClassifier.js` | **Create** | Gemini-based genre classification |
| `server/migrations/008_add_audio_profile.sql` | **Create** | Add `audio_profile` column to `books` |
| `server/src/services/llmDirector.js` | **Modify** | Accept `audioProfile` parameter |
| `server/src/routes/studioRoutes.js` | **Modify** | Classify on book create; fetch profile for spatial preview |
| `client/src/pages/Dashboard.jsx` | **Modify** | Add spatial toggle to right panel |

---

## Step 1: Migration — `audio_profile` column

Create `server/migrations/008_add_audio_profile.sql`:
```sql
-- Phase 4: add audio_profile (genre classification) to books table
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS audio_profile TEXT NOT NULL DEFAULT 'General Narrative';

-- Index for filtering books by profile (future use)
CREATE INDEX IF NOT EXISTS books_audio_profile_idx ON public.books (audio_profile);
```

Run via: `npx supabase migration apply` or equivalent.

---

## Step 2: Genre Classifier Service

Create `server/src/services/genreClassifier.js`:
```js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
);

const MODEL = 'gemini-1.5-flash';

export async function classifyBookGenre(sampleText) {
  if (!sampleText || typeof sampleText !== 'string' || !sampleText.trim()) {
    return 'General Narrative';
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      Analyze this opening text of a book and classify its atmospheric genre into ONE short, punchy category (e.g., "Noir Thriller", "Indian Folklore", "Sci-Fi Cyberpunk", "Historical Drama", "Cozy Mystery").
      Return a strict JSON object: { "genre": "..." }

      Text sample:
      "${sampleText.slice(0, 1000)}"
    `.trim();

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
    return data.genre || 'General Narrative';
  } catch (err) {
    console.warn('[Genre Classifier] Failed, defaulting:', err.message);
    return 'General Narrative';
  }
}
```

---

## Step 3: Update LLM Director

Modify `server/src/services/llmDirector.js`:
- Add `audioProfile` parameter (default: `'General Narrative'`)
- Inject `audioProfile` into the prompt instructions
- Move `genAI` initialization inside the function (or keep module-level — either works; module-level is fine since env var doesn't change)

Key change to prompt:
```
The overarching book genre/vibe is: "${audioProfile}".
Analyze the following text and break it down into a 3-track spatial audio script that heavily reflects this atmospheric profile.
```

---

## Step 4: Update `POST /` (Book Creation)

In `studioRoutes.js`, after inserting the book row (line ~201), classify the genre and update the book:

```js
// Insert book...
const { data: book, error: bookError } = await supabase
  .from('books')
  .insert({ ... })
  .select('*')
  .single();

// ponytail: classify genre after insert; non-blocking — book is still valid without it
const firstChapterText = chaptersData[0]?.text_content ?? '';
const audioProfile = await classifyBookGenre(firstChapterText);
await supabase
  .from('books')
  .update({ audio_profile: audioProfile })
  .eq('id', book.id)
  .eq('user_id', req.user.id);

// Include audio_profile in the response
res.json({ success: true, book: { ...book, audio_profile: audioProfile }, chapters: ... });
```

Also update the `GET /:bookId` route to include `audio_profile` in the select and response.

---

## Step 5: Update `POST /spatial-preview`

Modify to accept `bookId` in the request body, fetch the book's `audio_profile`, and pass it to `generateSpatialScript`:

```js
router.post('/spatial-preview', async (req, res) => {
  const { chapterText, bookId } = req.body;

  // If bookId provided, fetch audio_profile from DB
  let audioProfile = 'General Narrative';
  if (bookId) {
    const { data: book } = await supabase
      .from('books')
      .select('audio_profile')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();
    if (book?.audio_profile) {
      audioProfile = book.audio_profile;
    }
  }

  const script = await generateSpatialScript(chapterText.trim(), audioProfile);
  // ... rest same as Phase 3
});
```

---

## Step 6: UI Toggle in Dashboard

Add to `Dashboard.jsx` right panel, before the "Estimated credits" card:

```jsx
{/* Spatial 3D Engine Toggle */}
<div className="flex items-center gap-3 p-3 bg-muted/40 border border-border rounded-xl my-1">
  <div className="flex flex-col flex-1 min-w-0">
    <span className="text-sm font-medium text-foreground flex items-center gap-2">
      Spatial 3D Engine
      <span className="text-[10px] bg-terracotta/10 text-terracotta px-1.5 py-0.5 rounded-full font-semibold shrink-0">
        AI Director
      </span>
    </span>
    <span className="text-xs text-muted-foreground truncate">
      Multi-track spatial audio staging via FFmpeg
    </span>
  </div>
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input
      type="checkbox"
      checked={isSpatialEnabled}
      onChange={(e) => setIsSpatialEnabled(e.target.checked)}
      className="sr-only peer"
    />
    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-terracotta"></div>
  </label>
</div>
```

Add state: `const [isSpatialEnabled, setIsSpatialEnabled] = React.useState(false);`

When `isSpatialEnabled` is true and user clicks "Generate Audio":
- Call `POST /api/studio/spatial-preview` with `{ chapterText: chapter.text, bookId: book.id }`
- Return the spatial audio URL from the response

When false:
- Use existing single-track synthesis (`synthesizeAudio`)

---

## Execution Order

1. Create migration `008_add_audio_profile.sql`
2. Create `server/src/services/genreClassifier.js`
3. Update `llmDirector.js` — add `audioProfile` param
4. Update `studioRoutes.js` — classify on POST `/`, include `audio_profile` in GET `/`, pass profile to LLM director in `/spatial-preview`
5. Update `Dashboard.jsx` — add toggle state and UI, wire to synthesis flow
6. Validate: `node --check server/src/routes/studioRoutes.js`

---

## Validation
```bash
node --check server/src/routes/studioRoutes.js
node --check server/src/services/genreClassifier.js
node --check server/src/services/llmDirector.js
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Gemini unavailable for classification | Falls back to `'General Narrative'`, book creation still succeeds |
| No `GEMINI_API_KEY` set | Both classifier and director catch and return defaults |
| `bookId` not provided to `/spatial-preview` | Defaults to `'General Narrative'` |
| Toggle off → Generate Audio | Uses existing single-track TTS (no change in behavior) |
| Toggle on → Generate Audio | Calls `/spatial-preview`, replaces single-track audio with spatial mix |
| Existing books without `audio_profile` | Column defaults to `'General Narrative'` via migration |

---

## API Key Note
Requires existing `GEMINI_API_KEY` in `server/.env` (added in Phase 3). No new keys needed.

---

## Rollout
- Backward compatible: `audio_profile` has a default value
- Old books auto-default to `'General Narrative'`
- Toggle is off by default — no behavior change for existing users
- New books get classified on creation
