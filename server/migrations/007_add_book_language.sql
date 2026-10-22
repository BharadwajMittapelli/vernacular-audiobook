-- V2 Phase 7: add language column to books and chapters tables.
-- Safe to run repeatedly; IF NOT EXISTS makes it idempotent.
-- Default 'en-IN' seeds all existing rows without a migration step.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

-- Quick sanity index for "find my book by language" queries.
CREATE INDEX IF NOT EXISTS books_language_idx ON public.books (language);
CREATE INDEX IF NOT EXISTS chapters_language_idx ON public.chapters (language);
