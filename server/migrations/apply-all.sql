-- =============================================
-- SUPABASE MIGRATIONS FOR EKITHAB AUDIBOOK
-- Run these in Supabase SQL Editor:
-- https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql
-- =============================================

-- Migration 005: Create chapters table
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sequence_number integer not null,
  title text not null,
  text_content text not null,
  char_count integer not null,
  estimated_duration_seconds integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists chapters_book_id_sequence_number_idx
  on public.chapters (book_id, sequence_number);

alter table public.audio_generations
  add column if not exists chapter_uuid uuid references public.chapters(id) on delete cascade;

create index if not exists audio_generations_chapter_uuid_idx
  on public.audio_generations (chapter_uuid);

alter table public.chapters enable row level security;

-- Migration 006: Add book metadata columns
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Book',
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Migration 007: Add language columns
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

CREATE INDEX IF NOT EXISTS books_language_idx ON public.books (language);
CREATE INDEX IF NOT EXISTS chapters_language_idx ON public.chapters (language);

-- Ensure mock user exists for development auth bypass
insert into public.users (id, email, credits)
values ('00000000-0000-0000-0000-000000000001', 'mock@ekithab.local', 500)
on conflict (id) do nothing;
