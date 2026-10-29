
-- =============================================
-- 009_create_downloads_table.sql
-- =============================================
-- Stores download/export history for completed audiobook packages.
-- Metadata only — actual MP3 files are generated on-demand via the
-- existing export-mp3 endpoint. Cascade-deleted when the source book
-- is removed so orphan records cannot accumulate.

CREATE TABLE IF NOT EXISTS public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  book_title TEXT NOT NULL,
  book_cover_url TEXT,
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL DEFAULT 'mp3',
  file_size_bytes BIGINT,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS downloads_user_id_idx
  ON public.downloads (user_id);
CREATE INDEX IF NOT EXISTS downloads_exported_at_idx
  ON public.downloads (exported_at DESC);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own downloads" ON public.downloads;
CREATE POLICY "Users can view own downloads" ON public.downloads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own downloads" ON public.downloads;
CREATE POLICY "Users can insert own downloads" ON public.downloads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own downloads" ON public.downloads;
CREATE POLICY "Users can delete own downloads" ON public.downloads
  FOR DELETE TO authenticated USING (user_id = auth.uid());
