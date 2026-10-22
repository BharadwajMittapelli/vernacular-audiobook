# V2 Phase 1 — Chapters Table Migration (Dev B / Server)

## Objective
Create the idempotent SQL migration `005_create_chapters_table.sql` that establishes the `chapters` table, links it to `books`, `users`, and `audio_generations`, and locks it down with Row Level Security for the V2 Studio UI persistence layer.

## Scope Boundaries
- **One file only:** `server/migrations/005_create_chapters_table.sql` (new).
- No changes to Node.js routes, services, queues, client code, or migrations 001–004.
- Branch: `master` (verified: currently checked out).

## Verified Context (repo + live DB `znhhavbeqxoydojywttu`)
- Migrations live in `server/migrations/` (001–004 exist). Ticket path corrected to repo convention (confirmed with user).
- **Live DB check (2026-10-17):** no `chapters` table exists — `create table if not exists` will genuinely create it. `audio_generations.chapter_id` is confirmed nullable `text` (legacy), justifying the distinct `chapter_uuid` FK name.
- **Live DB:** `books`, `users`, `credit_transactions`, `audio_generations` all have `rls_enabled: true` — enabled via dashboard, never captured in migration files. Adding `enable row level security` to 005 brings `chapters` in line with the project pattern and closes the migration-capture gap.
- Repo style (001–004): lowercase SQL, `public.` schema prefix, inline `references` clauses, header comment with phase + "Safe to run repeatedly", FK columns indexed (e.g. `audio_generations_book_id_idx`).
- No migration runner script exists — migrations are applied manually (Supabase SQL editor / MCP `apply_migration`). `pgcrypto` was enabled in 002; `gen_random_uuid()` is native on the project's PG 17.11.

## Decisions
1. **File path:** `server/migrations/005_create_chapters_table.sql` (user-approved deviation from ticket's `server/src/migrations`).
2. **`status` column:** plain `text` with `default 'pending'`, **no CHECK constraint** — consistent with `books.status` (004); CHECK constraints are awkward to add idempotently and would need a `do $$` guard. Valid states (`pending`, `processing`, `completed`, `failed`) documented in a SQL comment.
3. **`(book_id, sequence_number)` index is non-unique** — spec asks for ordered sidebar retrieval only; enforcing uniqueness of sequence numbers is a future API-level decision.
4. **Bonus index on `audio_generations.chapter_uuid`** — matches the established pattern of indexing every FK column (001, 004) and will be needed when joins replace the legacy `chapter_id` lookups. Included as part of the same safe-guarded statements.
5. **RLS enabled with zero policies** — `alter table ... enable row level security` is itself idempotent. With no policies, `anon`/`authenticated` are denied all access via PostgREST; the server keeps working because it uses `service_role`, which has `BYPASSRLS`. Direct client reads of `chapters` therefore require policies in a later phase (explicitly out of scope below).

## File Content (write verbatim)

```sql
-- V2 Phase 1: chapters table for the Studio UI persistence layer.
-- Links chapter text to books/users and adds a chapter_uuid FK on
-- audio_generations (named chapter_uuid to avoid clashing with the
-- legacy text chapter_id column). Safe to run repeatedly.

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sequence_number integer not null,
  title text not null,
  text_content text not null,
  char_count integer not null,
  estimated_duration_seconds integer not null default 0,
  status text not null default 'pending', -- pending | processing | completed | failed
  created_at timestamptz not null default now()
);

-- Fast ordered retrieval for the UI sidebar.
create index if not exists chapters_book_id_sequence_number_idx
  on public.chapters (book_id, sequence_number);

-- Link generation rows to real chapter rows (legacy chapter_id stays untouched).
alter table public.audio_generations
  add column if not exists chapter_uuid uuid references public.chapters(id) on delete cascade;

create index if not exists audio_generations_chapter_uuid_idx
  on public.audio_generations (chapter_uuid);

-- Lock down the table to prevent unauthorized public access (service_role bypasses this)
alter table public.chapters enable row level security;
```

### Notes on the SQL
- `create table if not exists` + `add column if not exists` + `create index if not exists` make every statement re-runnable; on re-run the inline `references` in the skipped `add column` clause never executes, so no FK-already-exists error. `enable row level security` is a no-op when already enabled.
- Column types follow the ticket: `INT4`/`integer` and `TIMESTAMPTZ` map 1:1; `text` used for `status` per decision 2.
- `not null` on `status`/`estimated_duration_seconds`/timestamps mirrors `books` (004) defaults style; ticket left these implied and NOT-NULL-with-default cannot break existing rows since the new table starts empty and the added `chapter_uuid` column is nullable.
- Ticket-provided SQL was adopted verbatim after verifying it against the live DB (no `chapters` table conflict; FK targets `books(id)`/`users(id)` exist; legacy `chapter_id` is `text`).

## Rollout / Application
1. Write the file (implementation agent's job) — content above is final, no further design decisions remain.
2. Apply manually against Supabase project `znhhavbeqxoydojywttu` (SQL editor or MCP `apply_migration`, same as 001–004). No app-code path depends on it yet, so ordering vs. deploys is unconstrained.
3. Prerequisites verified live: `books`/`users`/`audio_generations` all exist, confirming 001–004 are applied.

## Validation
- Run the file **twice** end-to-end against the DB — second run must complete with zero errors (idempotency gate).
- Post-apply checks:
  ```sql
  select column_name, data_type, is_nullable, column_default
    from information_schema.columns
   where table_schema = 'public' and table_name = 'chapters'
   order by ordinal_position;

  select conname, confrelid::regclass, confdeltype
    from pg_constraint
   where conrelid in ('public.chapters'::regclass, 'public.audio_generations'::regclass)
     and contype = 'f';

  select indexname from pg_indexes
   where tablename in ('chapters', 'audio_generations')
     and indexname in ('chapters_book_id_sequence_number_idx', 'audio_generations_chapter_uuid_idx');

  select relrowsecurity from pg_class where relname = 'chapters';
  ```
- Expect: 9 columns on `chapters`; three CASCADE FKs (books, users, and `audio_generations.chapter_uuid`, all `confdeltype = 'c'`); both indexes present; `relrowsecurity = true`.
- Optional anon-key smoke test: `GET {SUPABASE_URL}/rest/v1/chapters?select=id` with the anon key must return `[]`/permission-denied rather than rows (RLS with zero policies blocks read).

## Risks
- Live DB verified to have no preconceived `chapters` table today (checked via MCP), but validation queries still confirm after apply in case dashboard drift occurred between plan and execution.
- `on delete cascade` from `users` means deleting a user purges their chapters; acceptable for V2 (matches ticket).
- RLS-with-no-policies means **any future client-side PostgREST read of `chapters` silently returns `[]`** until policies are added — call this out to whoever builds frontend chapter loading (Phase 2+).

## Out of Scope
- RLS **policies** or grants on `chapters` (server uses service_role; add policies in a later phase only if the client reads chapters directly).
- Backfilling `chapter_uuid` on existing `audio_generations` rows.
- Retro-fitting migration-file RLS statements for `books`/`users`/`credit_transactions`/`audio_generations` (already enabled live via dashboard; capturing them in a separate housekeeping migration is a follow-up).
- Any Express route, queue, or client changes.
