-- =============================================
-- 012_create_favorites.sql
-- =============================================
-- Phase 4: Favorites feature for Audio Library

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_user_chapter_unique UNIQUE (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_user_created_idx ON public.favorites (user_id, created_at DESC);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'favorites' 
      AND policyname = 'favorites_select_own'
  ) THEN
    CREATE POLICY "favorites_select_own" ON public.favorites
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'favorites' 
      AND policyname = 'favorites_insert_own'
  ) THEN
    CREATE POLICY "favorites_insert_own" ON public.favorites
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'favorites' 
      AND policyname = 'favorites_delete_own'
  ) THEN
    CREATE POLICY "favorites_delete_own" ON public.favorites
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;
