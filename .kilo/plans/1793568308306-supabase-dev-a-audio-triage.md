# Ekithab AI — Post-Migration Audio Troubleshooting & Hardening Plan

Scope: diagnose Audio Library + audiobook-creation breakage after moving Supabase credentials to the `dev-a` environment (Vercel frontend, Render/Railway backend), then apply minimal hardening. Ordered stages; each stage has a check, expected result, and branch. Do not skip stages: the three reported symptoms (universal 401, 409/500 on create/normalize/synthesize, empty Audio Library) have different owners.

## 0. Corrections to the prior draft (verified against this repo)

1. The frontend does **not** read or write `chapters` with the anon key. `client/src/lib/supabaseClient.ts` is used only for `supabase.auth.*` (`AuthContext.tsx`, `api.js`, `AccountTab.jsx`, `UpdatePassword.jsx`). Every table access goes through Express using the service-role client (`server/src/config/supabase.js`).
2. Therefore `chapters` RLS enabled with **zero policies = deny-all**, which is the correct, safe state for this architecture. Missing `chapters` policies is **not** a root cause of the current failures, and the four proposed policies (including `USING (auth.role() = 'service_role')`, which is redundant because `service_role` bypasses RLS) must **not** be applied as a "fix". Adding permissive user-CRUD policies would widen the attack surface for no functional gain. Treat as a separate, explicitly approved access-model change only if anon-key table access is ever introduced.
3. `client/.env` and `server/.env` already exist locally and both point to `https://sgpkxgwnxusjagjnesir.supabase.co`; `server/.env` holds a service-role key, `client/.env` holds the anon key. The draft's "create client/.env" step is stale for the local machine — the open question is what the **deployed** Vercel build inlined, not what the local file contains.
4. `NODE_ENV=development` + no `Authorization` header makes `authMiddleware` silently substitute the mock user `00000000-0000-0000-0000-000000000001` (`server/src/middleware/auth.js:7-10`). `server/.env` also sets `DEV_BYPASS_CREDITS=true`. Both must be absent from any shared/deployed environment.
5. The Telugu PDF warning is a real validation gate that returns **HTTP 400**, not a warning (`server/src/routes/documentRoutes.js:130-135`), and it blocks book creation. It is unrelated to auth.
6. The current Supabase MCP identity has no read grants (`database_read`, `project_admin_read`, `advisors_read` all refused), so live DB checks must run in the Supabase SQL editor (read-only SQL provided below) or after re-scoping the MCP token.

## 1. Stage A — Establish the failing topology (no changes)

A1. Record, for the failing environment: Vercel deployment URL, Vercel env **categories** set for `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_API_URL`, last deploy time; Render/Railway service URL and its env keys. Vite inlines `VITE_*` at **build time**: changing env without a redeploy leaves the old value in the shipped bundle — the most common post-migration 401 source.

A2. In the browser DevTools console of the failing deployment:
```js
const r = JSON.parse(atob(localStorage(Object.keys(localStorage).find(k=>k.startsWith('sb-'))).slice(1)));
Object.keys(r).flatMap(k=>Object.keys(r[k]||{}))
```
Then decode the stored `access_token` payload:
```js
JSON.parse(atob(localStorage.getItem('<sb-...-session>').match(/"access_token":"([^"]+)/)[1].split('.')[1]))
```
Expected: `iss === "supabase"` and `ref === "sgpkxgwnxusjagjnesir"`.
- `ref` ≠ shared project → stale session from another project → Stage B1.
- `ref` correct → Stage B2 (backend-side validation).

A3. curl the deployed backend and compare its key reference to the frontend's (never print keys):
```bash
curl -sS https://<backend>/health
```
Then on the backend host, verify only the **reference** substring of `SUPABASE_URL` equals `sgpkxgwnxusjagjnesir`, and that `SUPABASE_SERVICE_ROLE_KEY`'s decoded `role` is `service_role` (not `anon`). A `SUPABASE_URL` from the old project, or an anon key placed in `SUPABASE_SERVICE_ROLE_KEY`, produces exactly "Invalid or expired token" for every request plus storage/RLS bypass failures downstream.

A4. Check the browser Network tab for a failed `OPTIONS` preflight on `/api/...`. `server/src/index.js:28` restricts CORS to a single `FRONTEND_URL`, defaulting to `http://localhost:5175`. A deployed backend without `FRONTEND_URL` set to the exact Vercel origin (scheme + host, no trailing slash) blocks **all** API calls, which users report as "everything fails". If preflight fails → Stage G1 (config) and the multi-origin hardening in Stage G.

## 2. Stage B — Auth chain (universal 401)

B1. Stale/mismatched session: sign out, clear `localStorage`/`sessionStorage`/cookies for the app origin, hard-reload, sign in again. Confirm Supabase → Authentication → **Redirect URLs** allowlist and **Site URL** include the deployed Vercel origin **and** `http://localhost:5175`, and that the Google provider is enabled in the shared project. Missing entries cause an OAuth handshake that never completes on the shared project, leaving the previous project's session in storage.

B2. Same-project token rejected: reproduce with a fresh token against the deployed backend:
```bash
curl -sS -H "Authorization: Bearer $TOKEN" https://<backend>/api/audio/credits
```
- 200 → the frontend bundle still carries the old project's anon key → redeploy Vercel with the three `VITE_*` vars set for the Preview **and** Production environments.
- 401 → backend config: `SUPABASE_URL` reference wrong, key `role` claim wrong, or the key was rotated/revoked in the new environment. Fix the backend secret, restart, retest.

B3. Confirm no deployed environment has `NODE_ENV=development`. If it does, unauthenticated requests are attributed to the mock user and authenticated requests to the real uid — two invisible data silos in one shared database (this is also a likely explanation for "Audio Library empty despite books/chapters existing"). After correction, run Stage F to identify rows written under the mock id.

## 3. Stage C — Database parity (500 on create/synthesize)

Run in Supabase SQL editor against `sgpkxgwnxusjagjnesir` (read-only):
```sql
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and table_name in ('books','chapters','audio_generations','downloads','favorites','playback_history','users')
order by table_name, column_name;

select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('deduct_credits','refund_credits','get_user_balance','increment_book_completion','mark_book_failed');

select r.relname, r.relrowsecurity from pg_class r join pg_namespace n on n.oid=r.relnamespace
where n.nspname='public' and r.relkind='r' order by 1;

select id, name, public from storage.buckets order by name;
```
Expected minimum columns, per `server/migrations/001..014`:
- `books`: `id,user_id,total_chapters,completed_chapters,status,created_at,title,cover_url,language,audio_profile,last_opened_at,webhook_url`
- `chapters`: `id,book_id,user_id,sequence_number,title,text_content,char_count,estimated_duration_seconds,status,created_at,language,raw_text,normalized,normalized_words`
- `audio_generations`: `id,user_id,chapter_id,chapter_uuid,book_id,language,audio_url,audio_path,duration,credits_used,alignment,idempotency_key,status,created_at`
- `downloads`: includes `export_type`, `book_chapter_id`; `favorites(user_id,book_id,chapter_id)`; `playback_history(user_id,book_id,chapter_id,first_played_at,last_played_at)`

Decision:
- Missing `chapters.raw_text` / `normalized` / `normalized_words` → migration **014** was never applied to the shared project. `POST /api/studio` inserts these columns (`studioRoutes.js:274-294`), so creation returns 500 with a PostgREST column error, and `/api/chapters/:id/normalize` 500s. This is the prime suspect for "audiobook creation broken". Apply `server/migrations/014_add_chapter_normalization.sql` (idempotent, `add column if not exists`, backfills `raw_text`).
- Missing `audio_generations.chapter_uuid`/`book_id`/`audio_path` or any of the five functions → apply the corresponding migrations in numeric order, then re-run Stage C.
- `server/scripts/migrate.js` and `apply-migrations-direct.js` do **not** execute DDL (they only print SQL). Never treat them as applied.
- `idempotency_key` unique index missing (`001`) → duplicate synthesis; verify with
```sql
select indexname from pg_indexes where schemaname='public' and tablename='audio_generations';
```

Function grants must be service-role-only (`002`, `004`); re-verify:
```sql
select p.proname, pg_catalog.array_agg(pg_catalog.rolname order by pg_catalog.rolname) as grantees
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_authid r on r.rolname in ('anon','authenticated','service_role')
where n.nspname='public' and p.proname in ('deduct_credits','refund_credits','get_user_balance','increment_book_completion','mark_book_failed')
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
group by 1;
```
Expected grantees: `service_role` only. If `anon`/`authenticated` appear, re-run the revoke/grant block in `002`/`004` — anyone could mint credits.

## 4. Stage D — Storage and playback (synthesis 500, silent audio failures)

D1. Bucket named `audiobook` must exist in the shared project and be **private**. `server/src/services/storageService.js:59-64` uploads to `AUDIO_BUCKET`; a missing bucket yields `Supabase upload failed` → chapter `status='failed'` and credits refunded (`studioRoutes.js:460-471`). Check the bucket list from Stage C and backend logs for that message.

D2. Signed-URL reachability test with the deployed backend's key (run only if the implementer is authorized for the storage admin API; otherwise reproduce via app synthesis). Expected: upload succeeds, `createSignedUrl` returns a URL that plays in a new tab.

D3. Known failure mode to watch: `resolveAudioUrl` (`storageService.js:37-47`) logs a warning and silently falls back to the stored `audio_url`. Because `audio_url` holds a 1-hour signed URL, any storage misconfiguration or expired row surfaces as a URL that returns 403/expired rather than a clean error. If Stage D logs contain `Signed URL generation failed`, the root cause is storage credentials/bucket, not the audio library.

D4. Legacy rows keep `audio_path` NULL and depend on the frozen `audio_url`. Verify how many completed rows exist without `audio_path` (read-only):
```sql
select count(*) filter (where audio_path is null) as legacy_rows, count(*) as completed
from public.audio_generations where status='completed';
```
High `legacy_rows` in a migrated project means playback will fail once those signed URLs expire; the remedy is re-synthesis of those chapters (or a copy-storage + re-sign migration), not a code hack.

## 5. Stage E — 409 states (expected behavior, verify rather than "fix")

- `409 "Chapters require script optimization before synthesis"` = JIT normalization gate (`studioRoutes.js:373-380`, `audioRoutes.js:143-157`, `chapterRoutes.js`). Resolve by calling `POST /api/chapters/:id/normalize` for the listed ids.
- If normalization then returns **502**: Groq is the failing dependency. `GROQ_API_KEY` must be valid in the backend environment, and `GROQ_NORMALIZER_MODEL` (default `qwen/qwen3.8-27b`) must exist for that key:
```bash
curl -sS -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
```
If the default model is absent, set `GROQ_NORMALIZER_MODEL`, `GROQ_DIRECTOR_MODEL`, `GROQ_CLASSIFIER_MODEL` to models that are actually available (the normalizer has no fallback and fails hard; the director/classifier degrade silently).
- `409 "Book not found"` / `"Cannot delete..."` are ownership/state guards, not config problems.

## 6. Stage F — Audio Library emptiness (data scoping, not RLS)

F1. `GET /api/library/all-audio` returns an item only when the chapter has `status='completed'` **and** a matching `audio_generations` row with `status='completed'` for the **same `user_id`** (`libraryRoutes.js:20-60`). Read-only check for the affected account:
```sql
select u.email, b.user_id, count(distinct b.id) books,
       count(c.id) filter (where c.status='completed') completed_chapters,
       count(g.id) filter (where g.status='completed') completed_audio
from public.users u
left join public.books b on b.user_id=u.id
left join public.chapters c on c.book_id=b.id
left join public.audio_generations g on g.chapter_uuid=c.id
group by 1,2 order by 5 desc nulls last;
```
If content is concentrated under `00000000-0000-0000-0000-000000000001`, the library was populated while `NODE_ENV=development` bypassed auth. Record the affected book ids; do **not** silently rewrite ownership in a shared project — decide explicitly whether to reassign or delete.

F2. The Audio Library "All" tab renders from `getPlaybackHistory()`, not `getAllLibraryAudio()` (`client/src/pages/AudioLibrary.jsx:33-64`). Playback history rows are written only by `POST /api/library/playback/log` after verified playback (`Dashboard.jsx:305-320`). A brand-new account therefore shows an empty library even when books and audio exist — correct behavior, not a migration bug. Verify with:
```sql
select user_id, count(*) from public.playback_history group by 1;
```
If this contradicts the product intent ("All Audio = everything generated"), that is a UI/data-source decision for a separate change, not part of this migration fix.

## 7. Stage G — Minimal hardening (code, authorized scope)

G1. `server/src/index.js` — replace the single-string `FRONTEND_URL` with a comma-separated allowlist, and fail loudly in production when it is unset. Keep the `/api/storefront` wildcard delegate unchanged. Acceptance: Vercel preview, Vercel production, and `http://localhost:5175` all get a valid `Access-Control-Allow-Origin`; unknown origins get none.

G2. `server/src/middleware/auth.js` — make the mock-user path explicit and non-deployable: apply it only when `NODE_ENV='development'` **and** an explicit `ALLOW_DEV_MOCK_USER=true`. This removes the silent data-silo failure mode while preserving local dev.

G3. `server/src/services/storageService.js` — when signing fails for a record that has `audio_path`, escalate to an error log that includes the storage error code (bucket missing vs invalid key vs object not found) instead of a warn-and-fallback. Keep the legacy fallback for rows without `audio_path` so existing playback does not regress.

G4. Env templates: add the three client vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FRONTEND_URL`) to `client/.env.example`, and `FRONTEND_URL`, `GROQ_API_KEY`, `GROQ_NORMALIZER_MODEL`, `GROQ_DIRECTOR_MODEL`, `GROQ_CLASSIFIER_MODEL`, `ALLOW_DEV_MOCK_USER` to `server/.env.example`. Correct `server/src/services/ttsProvider.js:241`'s expected name vs the local `.env` typo `GTTS_FALLBACK_ENABLED` (documented value is `TTS_FALLBACK_ENABLED`) — flag the mismatch in the plan's verification, do not change provider behaviour.

Out of scope for this plan (recorded, not implemented): anon-key access to `chapters`; reassignment of mock-user-owned data; the `GET /api/audio/:chapterId` lookup which matches on `chapter_id` **or** `chapter_uuid` without an ownership filter (`audioRoutes.js:54-65`) — a cross-user read risk that deserves its own security change; replacing the in-memory synthesis queue with Redis/BullMQ durability.

G5. `PROJECT_DOCUMENTATION.md` §10/§12: the documented Render recipe (`build: npm run build`, `start: node dist/index.js`) cannot work — `server/package.json` has no `build` script and the entry point is `src/index.js`. Correct it to `npm install` + `node src/index.js`, and list the full required backend env set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME`, `FRONTEND_URL`, `NODE_ENV=production`, `GNANI_*`, `TTS_PROVIDER`, `TTS_FALLBACK_ENABLED`, `GROQ_API_KEY`, `GROQ_*_MODEL`, optional `REDIS_URL`). The same section still asserts "the frontend never calls Supabase directly", which is no longer true (auth is client-side); correct that statement too.

## 8. Stage H — Verification gates

Run in order; each must pass before the next.

1. Local: `npm run dev` in `server` with `NODE_ENV=development` and `ALLOW_DEV_MOCK_USER=true`; `GET /health` → 200; `GET /api/audio/credits` → 200 (mock user).
2. Local: same request with `ALLOW_DEV_MOCK_USER` unset → 401 `Missing Authorization header` (proves G2).
3. CORS: `curl -sSD- -o /dev/null -H "Origin: https://<vercel-prod>" https://<backend>/api/studio` → header echoes the exact allowlisted origin; `Origin: https://evil.example` → no `Access-Control-Allow-Origin`.
4. Supabase: Stage C column/function/bucket queries match the expected sets above.
5. Auth: fresh Google sign-in on the deployed app; decoded token `ref` = `sgpkxgwnxusjagjnesir`; `/api/audio/credits` 200; no `Invalid or expired token` in any console.
6. Creation: upload an English `.txt`/`.md` → `POST /api/studio` 200 with `chapters[]` and `normalized=true`; row visible in `books`/`chapters` under the signed-in uid.
7. Indic path: upload a genuine Telugu PDF with `?language=te-IN` → 200; a Latin-script PDF with the same param → 400 (Stage E, expected by design).
8. Normalization: `POST /api/chapters/:id/normalize` → 200 with `normalized_text`; DB row flips `normalized=true` and sets `raw_text`.
9. Synthesis: single chapter → 200 with a playable signed URL; `audio_generations` row `completed` with non-null `audio_path`; chapter `completed`.
10. Bulk: `POST /api/studio/:bookId/synthesize-all` → 202, poll `/status` to `completed`; `increment_book_completion`/`mark_book_failed` show no errors in backend logs.
11. Playback: `GET /api/library/all-audio` non-empty; play in Studio logs `POST /api/library/playback/log`; Audio Library "All" tab then lists the chapter.
12. Export: `GET /api/studio/:bookId/export-mp3` streams a non-empty `audio/mpeg`.
13. Cross-account: second Google account sees zero books/chapters/audio from the first.
14. Quality: `npm run lint --workspace=server`, `npm run typecheck --workspace=client`, `npm test --workspace=server` (`node --test`; the client currently has no tests). Note `npm run build` at the repo root fails because `server/package.json` has no `build` script — the backend deploy must run `npm install` and start `node src/index.js`.

## 9. Rollback

- Env/platform: revert to the previous `dev-a` values and **redeploy** Vercel; backend changes take effect on restart. No code dependency.
- G1–G3 code: revert the touched files (`index.js`, `auth.js`, `storageService.js`) plus `.env.example` updates; they are additive and independent of each other.
- Migrations 014 and companions are additive columns only; rollback is `alter table public.chapters drop column if exists raw_text, drop column if exists normalized, drop column if exists normalized_words;` and it will immediately re-break `POST /api/studio` — roll forward, not back.
- Data ownership changes (Stage F1) are destructive: require an explicit decision and a row-level backup (`create table public._rollback_books_asis as select * from public.books;`) before any update.

## 10. Information still needed from the owner

1. The failing environment's exact URLs (Vercel deployment, backend host) and the timestamps of the last deploy and the last successful run.
2. Whether `014_add_chapter_normalization.sql` was ever run in `sgpkxgwnxusjagjnesir` (the Stage C column query answers this definitively).
3. Whether the Audio Library is expected to list all generated audio or only playback history (Stage F2) — this determines whether a separate UI change is required.
4. Whether an MCP token with `database_read` should be provisioned so schema/bucket state can be verified directly instead of via the SQL editor.
