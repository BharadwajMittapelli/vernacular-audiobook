
-- =============================================
-- 010_add_export_type_to_downloads.sql
-- =============================================
-- Adds export_type and book_chapter_id columns to distinguish
-- chapter-level exports (Studio) from full-book exports (My Books).
-- export_type defaults to 'full_book' so existing records are classified correctly.
-- book_chapter_id is nullable UUID — NULL for full-book exports.

ALTER TABLE public.downloads
  ADD COLUMN IF NOT EXISTS export_type TEXT NOT NULL DEFAULT 'full_book',
  ADD COLUMN IF NOT EXISTS book_chapter_id UUID NULL;
