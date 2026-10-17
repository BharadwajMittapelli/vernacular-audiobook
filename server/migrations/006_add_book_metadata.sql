-- V2 Phase 3: add missing metadata columns to books for Studio UI.
-- Safe to run repeatedly; IF NOT EXISTS makes it idempotent.
-- Without this, any Studio query selecting title/cover_url throws PGRST200.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Book',
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
