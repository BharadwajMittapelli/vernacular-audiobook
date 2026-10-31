-- =============================================
-- 011_create_playback_history.sql
-- =============================================
-- Phase 1: Playback history tracking for "All Audio" eligibility
-- Only chapters successfully played in Studio get a record here.

create table if not exists public.playback_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  first_played_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Prevent duplicate records per user+chapter (eligibility rule: replay updates existing)
create unique index if not exists playback_history_user_chapter_uidx
  on public.playback_history (user_id, chapter_id);

-- Fast retrieval: most recently played first
create index if not exists playback_history_user_last_played_idx
  on public.playback_history (user_id, last_played_at desc);

-- Lock down with RLS (server uses service role, but policies provide defense-in-depth)
alter table public.playback_history enable row level security;

-- Policies mirror existing convention: users can only see/insert their own history
create policy "playback_history_select_own" on public.playback_history
  for select using (user_id = auth.uid());

create policy "playback_history_insert_own" on public.playback_history
  for insert with check (user_id = auth.uid());

create policy "playback_history_update_own" on public.playback_history
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());