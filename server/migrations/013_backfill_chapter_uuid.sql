-- =============================================
-- 013_backfill_chapter_uuid.sql
-- =============================================
-- Phase 4.1: Backfill chapter_uuid in audio_generations
-- Safe to execute repeatedly. Only updates rows where chapter_uuid is NULL
-- and chapter_id matches an existing chapters.id (as UUID text).

-- Before: how many generations are unlinked?
-- SELECT count(*) AS unlinked_generations FROM public.audio_generations WHERE chapter_uuid IS NULL;

UPDATE public.audio_generations ag
SET chapter_uuid = c.id
FROM public.chapters c
WHERE ag.chapter_uuid IS NULL
  AND ag.chapter_id IS NOT NULL
  AND c.id::text = ag.chapter_id;

-- After: how many generations are still unlinked?
-- SELECT count(*) AS remaining_unlinked FROM public.audio_generations WHERE chapter_uuid IS NULL;
