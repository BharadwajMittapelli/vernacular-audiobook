-- Phase 4.2: tables, columns, and RPCs for async bulk synthesis.
-- Spec: .kilo/plans/1791744699973-async-queue.md. Safe to run repeatedly.

-- Track bulk book jobs.
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  total_chapters integer not null default 0,
  completed_chapters integer not null default 0,
  webhook_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Link async-generation rows to their parent book.
alter table public.audio_generations
  add column if not exists book_id uuid references public.books(id) on delete set null;

create index if not exists audio_generations_book_id_idx
  on public.audio_generations (book_id);

create index if not exists books_status_idx
  on public.books (status) where status != 'completed';

-- Atomic balance query for async pre-flight credit check.
create or replace function public.get_user_balance(p_user_id uuid)
returns integer language plpgsql as $$
declare v integer;
begin
  select credits into v from public.users where id = p_user_id;
  return coalesce(v, 0);
end; $$;

-- Atomic completion increment. Returns { completed, total }.
-- Handles concurrent completions safely; serializes via row lock.
create or replace function public.increment_book_completion(p_book_id uuid)
returns json language plpgsql as $$
declare
  v_completed integer;
  v_total     integer;
begin
  update public.books
     set completed_chapters = completed_chapters + 1
   where id = p_book_id
  returning completed_chapters, total_chapters
    into v_completed, v_total;

  if not found then
    raise exception 'BOOK_NOT_FOUND' using errcode = 'P0001';
  end if;

  return json_build_object('completed', v_completed, 'total', v_total);
end; $$;

-- Mark a book as failed (fires when any chapter job fails).
create or replace function public.mark_book_failed(p_book_id uuid)
returns void language plpgsql as $$
begin
  update public.books
     set status = 'failed'
   where id = p_book_id;
end; $$;

-- Lock down like 002: default EXECUTE TO PUBLIC would expose these at
-- /rest/v1/rpc/ to the anon key. Server uses service_role only.
revoke execute on function public.get_user_balance(uuid)              from public, anon, authenticated;
revoke execute on function public.increment_book_completion(uuid)     from public, anon, authenticated;
revoke execute on function public.mark_book_failed(uuid)              from public, anon, authenticated;

grant execute on function public.get_user_balance(uuid)          to service_role;
grant execute on function public.increment_book_completion(uuid) to service_role;
grant execute on function public.mark_book_failed(uuid)          to service_role;
