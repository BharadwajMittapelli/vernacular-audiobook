-- Phase 4: add audio_profile (genre classification) to books table
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS audio_profile TEXT NOT NULL DEFAULT 'General Narrative';

-- Index for filtering books by profile (future use)
CREATE INDEX IF NOT EXISTS books_audio_profile_idx ON public.books (audio_profile);
