-- Align public.audio_generations with the Backend Schema Document (PROJECT_DOCUMENTATION.md section 5).
-- The live table was missing user_id / language / credits_used and named duration as duration_seconds,
-- so POST /api/audio/synthesize failed with PGRST204 ("Could not find the 'credits_used' column").
-- Safe to run repeatedly.

alter table public.audio_generations
  add column if not exists user_id uuid,
  add column if not exists language text,
  add column if not exists credits_used integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audio_generations' and column_name = 'duration_seconds'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audio_generations' and column_name = 'duration'
  ) then
    alter table public.audio_generations rename column duration_seconds to duration;
  else
    alter table public.audio_generations add column if not exists duration double precision;
  end if;
end $$;

-- Required by the idempotency race handling in audioRoutes.js (SQLSTATE 23505 on idempotency_key)
create unique index if not exists audio_generations_idempotency_key_key
  on public.audio_generations (idempotency_key);

create index if not exists audio_generations_chapter_id_idx
  on public.audio_generations (chapter_id);
