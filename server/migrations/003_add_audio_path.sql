-- Phase 4.1: add audio_path column so signed URLs can be generated on demand.
-- Safe to re-run (IF NOT EXISTS).

-- Add the column; it is nullable so existing rows continue to work via audio_url.
alter table public.audio_generations
  add column if not exists audio_path text;

-- Index to support future lookups by path (optional but useful for audit/debug).
create index if not exists audio_generations_audio_path_idx
  on public.audio_generations (audio_path) where audio_path is not null;
