# Phase 4 Sprint 4.1 (DEV B / Server): Signed URLs & Anti-Ripping Protection

**Branch:** `dev-server` · **Scope:** `/server` only · **Role:** Dev B (Backend Lead)

## Goal
Stop leaking persistent public CDN URLs on the public storefront embed. Add an `audio_path` column to `audio_generations`, make `uploadAudio` store the raw storage key, generate 1-hour signed streaming URLs on demand, and return signed URLs in all response paths so existing frontend contracts break nothing.

---

## Decisions

### Decision 1 — Option A with Private Bucket Posture (confirmed by product owner)
- **`audio_generations.audio_path`** (text, nullable) stores the raw storage key, e.g. `audiobook/<chapterId>/<uuid>.mp3`.
- **`audio_url`** continues to store the final URL returned to clients — but on the *first read* after upload, it is populated with a signed URL rather than a public CDN URL. This preserves the response shape for DEV A's client without touching the schema contract.
- The `audiobook` Supabase bucket must be switched to **Private** as a deployment step (documented below); this prevents raw public-URL access for any row whose `audio_path` was never populated.
- The auth-facing routes (`POST /synthesize`, `GET /:chapterId`) also return signed URLs so even the creator dashboard gets time-limited tokens. If the creator wants a persistent URL later, `getPublicUrl()` can be called explicitly.

### Decision 2 — `uploadAudio` signature change
`uploadAudio(audioBuffer, chapterId, format)` stays the same externally but now returns **both** the signed URL (for the response) and the raw `audioPath` (stored in DB). The caller writes `audio_path` and uses the signed URL as `audio_url` in the generation row.

### Decision 3 — Signed URL TTL
`expiresInSeconds = 3600` (1 hour) for all three response paths. A fresh 1h token is generated per response — **no response path returns the stored `audio_url` as the final token** if `audio_path` is present. The stored `audio_url` is kept only as a legacy fallback for rows generated before this migration (where `audio_path` is null).

### Decision 3a — Fresh URL on every read (MANDATORY correction)
Every route that returns a completed generation to a client **must** call `resolveAudioUrl(record)` to produce the response `audioUrl`. This ensures:
- Idempotency fast-path replays (>1h after generation) get a fresh signed URL, not a dead one.
- Polling losers see a valid URL once the primary request completes.
- `GET /:chapterId` never serves an expired token.

### Decision 4 — What happens if `createSignedUrl` fails?
Return the original `audio_url` (public CDN path) as a fallback and log a warning — this ensures the public bucket case (pre-transition) doesn't break. Once the bucket is fully private and signed-URL generation works, this branch is unreachable.

### Decision 5 — Backward compatibility for existing rows
Rows generated before this migration have `audio_path = null`. For those, fall back to `audio_url` as-is (the public URL). A one-shot migration seed will populate `audio_path` for existing completed generations by parsing the public URL path segment — or we document that pre-transition rows remain publicly accessible until they are regenerated. **Recommended:** skip backfill; pre-transition rows stay public (they were already exposed). New rows get signed URLs.

---

## Files to Create / Modify

### 1. NEW migration: `server/migrations/003_add_audio_path.sql`
```sql
-- Phase 4.1: add audio_path column so signed URLs can be generated on demand.
-- Safe to re-run (IF NOT EXISTS).

-- Add the column; it is nullable so existing rows continue to work via audio_url.
alter table public.audio_generations
  add column if not exists audio_path text;

-- Index to support future lookups by path (optional but useful for audit/debug).
create index if not exists audio_generations_audio_path_idx
  on public.audio_generations (audio_path) where audio_path is not null;
```

### 2. EDIT `server/src/services/storageService.js`
Add a new exported function `getSignedAudioUrl(filePath, expiresInSeconds = 3600)` and refactor `uploadAudio` to store both path and URL.

```javascript
import { supabase, AUDIO_BUCKET } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

const FORMAT_MAP = {
  mp3: { ext: 'mp3', contentType: 'audio/mpeg' },
  wav: { ext: 'wav', contentType: 'audio/wav' },
};

/**
 * Generate a time-limited signed streaming URL for a stored audio file.
 * @param {string} filePath  - Raw storage path, e.g. "audiobook/<chapterId>/<uuid>.mp3"
 * @param {number} expiresInSeconds
 * @returns {Promise<string>} Signed URL string
 * @throws {Error} if the bucket is private and the file doesn't exist
 */
export async function getSignedAudioUrl(filePath, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    throw new Error(`Signed URL generation failed: ${error.message}`);
  }
  return data.signedUrl;
}

/**
 * Return a fresh signed URL for a generation record if audio_path exists,
 * otherwise fall back to the stored audio_url (legacy public CDN row).
 *
 * This is the single source of truth for every read path — it prevents
 * returning expired tokens from the idempotency cache or polling branch.
 *
 * @param {{ audio_path?: string | null, audio_url?: string | null }} record
 * @returns {Promise<string|null>} Fresh signed URL or fallback audio_url, or null if neither exists
 */
export async function resolveAudioUrl(record) {
  if (record.audio_path) {
    try {
      return await getSignedAudioUrl(record.audio_path, 3600);
    } catch (signError) {
      console.warn(`[Storage] Signed URL generation failed for ${record.audio_path}: ${signError.message}`);
    }
  }
  // Legacy fallback: pre-migration rows or signed-URL failure
  return record.audio_url || null;
}

/**
 * Upload audio buffer, store raw path, and return both path and a fresh signed URL.
 * The signed URL is what gets returned to clients (preserves audio_url response shape).
 *
 * @returns {{ audioPath: string, signedAudioUrl: string }}
 */
export async function uploadAudio(audioBuffer, chapterId, format = 'wav') {
  const { ext, contentType } = FORMAT_MAP[format] || FORMAT_MAP.wav;
  const fileName = `${chapterId}/${uuidv4()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, audioBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  // Generate a time-limited signed URL (anti-ripping: replaces persistent public CDN links)
  const signedUrl = await getSignedAudioUrl(fileName, 3600);

  return { audioPath: fileName, signedAudioUrl: signedUrl };
}
```

### 3. EDIT `server/src/routes/audioRoutes.js`
- Add import for `resolveAudioUrl` from `../services/storageService.js`.
- Change the `uploadAudio` call at line ~203 to destructure `{ audioPath, signedAudioUrl }`.
- Write `audio_path` alongside `audio_url` in the completion UPDATE at line ~208.
- **Every read path that returns `audioUrl` must call `resolveAudioUrl(record)` instead of using `record.audio_url` directly.** Three locations are affected:

#### 3a — `GET /:chapterId` (lines 25–51)
Current: reads `audio_url` from DB and returns it directly.
Change: after fetching `data`, call `const audioUrl = await resolveAudioUrl(data)` and return `audioUrl` in the response. If `audioUrl` is null, return 404.

#### 3b — Idempotency fast-path (lines 76–92)
Current: `existing.audio_url` returned directly.
Change: after fetching `existing`, call `const audioUrl = await resolveAudioUrl(existing)`; if null → 404; else return `audioUrl` in the response.

#### 3c — Polling branch (lines 141–149)
Current: `record.audio_url` returned directly.
Change: before the `if (record.audio_url)` check, call `const audioUrl = await resolveAudioUrl(record)`; if null → continue polling; else return `audioUrl` in the response.

#### 3d — Completion INSERT (lines ~200–214)
Replace the existing `audioUrl = await uploadAudio(...)` and subsequent `update` block:

```javascript
const { audioPath, signedAudioUrl } = await uploadAudio(
  result.audioBuffer,
  chapterId,
  isGtts ? 'mp3' : 'wav'
);

await supabase
  .from('audio_generations')
  .update({
    audio_url: signedAudioUrl,   // legacy fallback; primary path is audio_path
    audio_path: audioPath,
    duration: totalDuration,
    credits_used: creditsUsed,
    alignment,
    status: 'completed',
  })
  .eq('id', inserted.id);
```

#### 3e — Response object
The `res.json` at line ~233 uses `audioUrl` — ensure it's the value from `resolveAudioUrl` (or the inline fallback above), not the raw DB column.

Import: add `import { resolveAudioUrl } from '../services/storageService.js';` to the existing import block.

### 4. EDIT `server/src/routes/storefrontRoutes.js`
Replace the current `GET /embed/:generationId` handler to use `resolveAudioUrl` instead of hand-writing the signing logic inline:

1. Import `resolveAudioUrl` from `../services/storageService.js`.
2. Query `audio_path` in addition to `audio_url` (the select must include both columns).
3. After fetching `data`, call `const audioUrl = await resolveAudioUrl(data)`.
4. If `audioUrl` is null → 404.
5. Return `audioUrl` as the `audioUrl` field in the response.

```javascript
import { resolveAudioUrl } from '../services/storageService.js';

// ... inside the handler, after fetching data ...
const audioUrl = await resolveAudioUrl(data);
if (!audioUrl) {
  return res.status(404).json({ success: false, error: 'Not found' });
}

res.json({
  success: true,
  generationId: data.id,
  chapterId: data.chapter_id,
  audioUrl,
  durationSeconds: data.duration,
  alignment: data.alignment || [],
});
```

The DB query becomes:
```javascript
.select('id, chapter_id, audio_url, audio_path, duration, alignment')
```

Note: `audio_url` is still selected for the legacy fallback path but is never used directly in the response — `resolveAudioUrl` owns the decision.

### 5. DEPLOYMENT STEP (documented, not coded)
After deploying this migration, the Supabase dashboard operator must:
1. Navigate to **Storage → Buckets → `audiobook`** (or whatever `SUPABASE_BUCKET_NAME` is set to).
2. Change **Access model** from `Public` to `Private`.
3. Ensure no RLS policy blocks the `service_role` from reading objects (it shouldn't — service role bypasses RLS).
4. Add a signed URL policy if desired (optional; service_role key is sufficient for server-side `createSignedUrl`).

**This step is required for the anti-ripping guarantee.** Until the bucket is private, existing public URLs remain accessible to anyone who discovered them.

---

## Execution Order

1. Run migration `003_add_audio_path.sql` against the Supabase project.
2. Edit `storageService.js` — add `getSignedAudioUrl`, update `uploadAudio` return shape.
3. Edit `audioRoutes.js` — use new `uploadAudio` return, persist `audio_path`, write signed URL to `audio_url`.
4. Edit `storefrontRoutes.js` — query `audio_path`, generate signed URL on demand, return it.
5. Run `npm run lint` to verify syntax.
6. Verify: POST synthesize → response has a signed URL in `audioUrl`; GET storefront embed → response has a signed URL; row in DB has both `audio_path` and `audio_url`.

---

## Validation

| Check | Command / Action | Pass Criteria |
|-------|-----------------|---------------|
| Lint | `npm run lint` in `/server` | Zero errors |
| Syntax | `node --check src/index.js` | No syntax errors |
| Synthesize happy path | `POST /api/audio/synthesize` with valid payload | 200; `audioUrl` starts with `https://.../object/sign/...` (signed URL format); `audio_path` stored in DB |
| Storefront embed | `GET /api/storefront/embed/:generationId` (real ID) | 200; `audioUrl` is a fresh signed URL; `Access-Control-Allow-Origin: *` |
| Legacy row fallback | Query an `audio_generations` row with `audio_path IS NULL` (pre-migration) | Returns `audio_url` as-is without error |
| Bucket private | Confirm in Supabase dashboard after deploy | Bucket access model = Private |
| Idempotency preserved | Same `Idempotency-Key` twice | Second response has a **fresh** signed URL (not the original stored one); no double charge; playback works >1h after generation |
| Expired-token replay  | POST synthesize → wait 2h → POST same key again | Response contains a valid (fresh) signed URL, not the original expired token |
| Storefront stale row  | GET embed for a generation created >1h ago | Returns a fresh signed URL; playback works |

---

## Risks / Known Gaps
- **Pre-transition public URLs:** Existing completed generations have `audio_path = null` and a public `audio_url`. They remain publicly accessible until regenerated. This is acceptable for a phased rollout.
- **Bucket switch timing:** The bucket must be switched to private *after* the migration is deployed and new rows have `audio_path`. Switching before the migration lands will cause `createSignedUrl` to work (service_role bypasses RLS) but existing public URLs will break for any client that cached them. Coordinate the deploy window.
- **`resolveAudioUrl` adds one extra Supabase call per read:** negligible latency (~10-50ms) vs the benefit of never serving expired tokens. Acceptable trade-off.
- **No bulk signing:** Not required for Sprint 4.1. Bulk signed URL generation is a Phase 4.2 concern.

---

## Out of Scope
- Async bulk rendering (Phase 4.2 — requires `bullmq` + Redis).
- Automated quality auditing (Phase 4.3 — requires a separate audit service).
- Client-side changes (DEV A scope).
- Multi-instance rate-limit store for storefront (in-memory is fine for single Render instance).
