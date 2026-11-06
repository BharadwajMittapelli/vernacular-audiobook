-- 016: Schema parity fixes previously applied ad-hoc via MCP to znhhavbeqxoydojywttu.
-- Idempotent; safe on fresh rebuilds (015 creates credits) and on the live DB.

-- downloads: log-endpoint columns
alter table public.downloads
  add column if not exists book_title text,
  add column if not exists book_cover_url text,
  add column if not exists file_name text,
  add column if not exists file_format text,
  add column if not exists file_size_bytes integer,
  add column if not exists exported_at timestamptz,
  add column if not exists export_type text,
  add column if not exists book_chapter_id uuid references public.chapters(id) on delete set null;

-- Guarded FK creation: the inline REFERENCES above only attaches the FK when the
-- column is newly created. On the live DB the column already exists, so ensure
-- downloads_book_chapter_id_fkey exists regardless.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'downloads_book_chapter_id_fkey'
      and conrelid = 'public.downloads'::regclass
  ) then
    alter table public.downloads
      add constraint downloads_book_chapter_id_fkey
      foreign key (book_chapter_id) references public.chapters(id) on delete set null;
  end if;
end $$;

-- playback_history: played-at columns + upsert target unique index
alter table public.playback_history
  add column if not exists first_played_at timestamptz,
  add column if not exists last_played_at timestamptz;
alter table public.playback_history alter column first_played_at set default now();
create unique index if not exists playback_history_user_chapter_uidx
  on public.playback_history (user_id, chapter_id);

-- favorites: per-chapter favorites
alter table public.favorites
  add column if not exists chapter_id uuid references public.chapters(id) on delete cascade;
drop index if exists favorites_user_id_book_id_idx;
create unique index if not exists favorites_user_id_chapter_id_idx
  on public.favorites (user_id, chapter_id);

-- Decision (2026-11-06): normalized DEFAULT false is production behavior (fail-closed:
-- an un-flagged chapter must hit the JIT normalization gate, never silent synthesis).
-- Overrides 014's DEFAULT true. Studio insert always sets normalized explicitly.
alter table public.chapters alter column normalized set default false;

-- E2E finding (2026-11-06): log-endpoint flow has no audio_url; column kept for legacy rows only
alter table public.downloads alter column audio_url drop not null;
