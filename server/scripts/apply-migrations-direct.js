/**
 * Apply Supabase migrations using the service role key
 * 
 * This script directly applies pending migrations to your Supabase database.
 * Run with: node server/scripts/apply-migrations-direct.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// SQL migrations to apply
const MIGRATIONS = `
-- Migration 005: Create chapters table
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sequence_number integer not null,
  title text not null,
  text_content text not null,
  char_count integer not null,
  estimated_duration_seconds integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists chapters_book_id_sequence_number_idx
  on public.chapters (book_id, sequence_number);

alter table public.audio_generations
  add column if not exists chapter_uuid uuid references public.chapters(id) on delete cascade;

create index if not exists audio_generations_chapter_uuid_idx
  on public.audio_generations (chapter_uuid);

alter table public.chapters enable row level security;

-- Migration 006: Add book metadata columns
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Book',
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Migration 007: Add language columns
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

CREATE INDEX IF NOT EXISTS books_language_idx ON public.books (language);
CREATE INDEX IF NOT EXISTS chapters_language_idx ON public.chapters (language);

-- Ensure mock user exists for development
insert into public.users (id, email, credits)
values ('00000000-0000-0000-0000-000000000001', 'mock@ekithab.local', 500)
on conflict (id) do nothing;
`;

async function applyMigrations() {
  console.log('🚀 Applying Supabase migrations...');
  console.log(`📍 Database: ${SUPABASE_URL.replace(/\/\/.*@/, '//***:***@')}...`);
  console.log('================================\n');
  
  try {
    // Supabase REST API doesn't support arbitrary SQL directly
    // We need to use the RPC or execute via PostgREST
    
    // Check current state first
    console.log('📊 Checking current database state...\n');
    
    // Check books table columns
    const { data: booksData, error: booksError } = await supabase
      .from('books')
      .select('*')
      .limit(1);
    
    if (booksError) {
      console.log(`books table error: ${booksError.message}`);
    } else {
      console.log('✅ books table exists');
      if (booksData && booksData.length > 0) {
        console.log(`   Sample row keys: ${Object.keys(booksData[0]).join(', ')}`);
      }
    }
    
    // Check chapters table
    const { error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .limit(1);
    
    if (chaptersError && chaptersError.code === 'PGRST301') {
      console.log('⚠️  chapters table does not exist - needs migration 005');
    } else if (chaptersError) {
      console.log(`chapters table error: ${chaptersError.message}`);
    } else {
      console.log('✅ chapters table exists');
    }
    
    console.log('\n================================');
    console.log('📋 MIGRATION SQL TO RUN:');
    console.log('================================\n');
    console.log(MIGRATIONS.trim());
    console.log('\n================================');
    console.log('Instructions:');
    console.log('1. Open: https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql');
    console.log('2. Copy the SQL above and paste it into the editor');
    console.log('3. Click "Run"');
    console.log('4. Verify success');
    console.log('================================');
    
  } catch (err) {
    console.error('❌ Error checking database:', err.message);
  }
}

applyMigrations();
