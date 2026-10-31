# Fix: All Audio Playback History API — HTTP 500 Error

## Root Cause

The `playback_history` table **does not exist in the database**. Migration `011_create_playback_history.sql` was created but never included in any apply script (`apply-all.sql` or `pending.sql`), so it was never executed against the Supabase database.

When `GET /api/library/playback/history` queries `from('playback_history')`, Supabase returns a 500 error because the table is missing.

## Evidence

- Migration file exists: `server/migrations/011_create_playback_history.sql`
- Not included in: `server/migrations/apply-all.sql` (stops at migration 007)
- Not included in: `server/migrations/pending.sql` (stops at migration 007)
- The endpoint at `libraryRoutes.js:241-282` queries `playback_history` with joins to `books` and `chapters`
- All referenced columns (`books.title`, `books.cover_url`, `chapters.title`, `chapters.sequence_number`) exist in the database from earlier migrations

## Verification Before Applying

Run these checks in Supabase SQL Editor **before** applying the migration:

```sql
-- 1. Check if table exists
SELECT to_regclass('public.playback_history') AS table_exists;

-- 2. Check for partial migration (indexes/policies without table)
SELECT indexname FROM pg_indexes WHERE tablename = 'playback_history';
SELECT policyname FROM pg_policies WHERE tablename = 'playback_history';

-- 3. Verify referenced tables and UUID types
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'books', 'chapters') 
  AND column_name = 'id';
```

## Fix — Safe Migration with DO Blocks

Apply **only if table is missing or migration is incomplete**. Run in Supabase SQL Editor:

```sql
-- 011_create_playback_history.sql (safe version)

-- Create table if missing
CREATE TABLE IF NOT EXISTS public.playback_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  first_played_at timestamptz NOT NULL DEFAULT now(),
  last_played_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique index if missing (preserves existing)
CREATE UNIQUE INDEX IF NOT EXISTS playback_history_user_chapter_uidx
  ON public.playback_history (user_id, chapter_id);

-- Create lookup index if missing
CREATE INDEX IF NOT EXISTS playback_history_user_last_played_idx
  ON public.playback_history (user_id, last_played_at DESC);

-- Enable RLS if not already enabled
ALTER TABLE public.playback_history ENABLE ROW LEVEL SECURITY;

-- Safely create policies (guards against duplicate-policy errors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'playback_history' 
      AND policyname = 'playback_history_select_own'
  ) THEN
    CREATE POLICY "playback_history_select_own" ON public.playback_history
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'playback_history' 
      AND policyname = 'playback_history_insert_own'
  ) THEN
    CREATE POLICY "playback_history_insert_own" ON public.playback_history
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'playback_history' 
      AND policyname = 'playback_history_update_own'
  ) THEN
    CREATE POLICY "playback_history_update_own" ON public.playback_history
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
```

## Verification After Applying

1. **Schema verification:**
   ```sql
   -- Table exists
   SELECT to_regclass('public.playback_history');
   
   -- Indexes exist
   SELECT indexname FROM pg_indexes WHERE tablename = 'playback_history';
   
   -- Policies exist
   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'playback_history';
   ```

2. **API test:**
   - Call `GET /api/library/playback/history` with valid auth token
   - Expect: `{ success: true, history: [] }` for users with no playback history

3. **Integration test:**
   - Play a chapter in Studio → verify it appears in history
   - Replay the same chapter → verify no duplicate (unique index preserved)
   - Verify user isolation (other users don't see the history)
   - Refresh Audio Library → confirm error is gone

4. **Frontend build:**
   - `cd client && npm run build` → passes

## Constraints

- ✅ No backend route modifications
- ✅ No frontend component modifications  
- ✅ No authentication changes
- ✅ No existing table modifications
- ✅ No new migrations created
- ✅ Preserves unique index on `(user_id, chapter_id)`
- ✅ Preserves all Phase 1/2/3 functionality

## Risk

- Low: All operations are idempotent (`IF NOT EXISTS`, DO blocks)
- No schema changes to existing tables
- No data loss
- Preserves all Phase 1/2/3 functionality