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
