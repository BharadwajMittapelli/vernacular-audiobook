/**
 * Apply Supabase migrations using PostgREST
 * 
 * This script uses the Supabase REST API to run migrations.
 * Run with: node server/scripts/apply-migrations-postgrest.js
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Check if chapters table exists
async function checkChaptersTable() {
  const { data, error } = await supabase
    .from('chapters')
    .select('id')
    .limit(1);
  
  if (error) {
    if (error.code === 'PGRST301' || error.message?.includes('does not exist')) {
      return false;
    }
    console.error('Error checking chapters:', error.message);
    return null;
  }
  return true;
}

// Check if language column exists on books
async function checkLanguageColumn() {
  const { data, error } = await supabase
    .from('books')
    .select('id, language')
    .limit(1);
  
  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('language')) {
      return false;
    }
    console.error('Error checking language column:', error.message);
    return null;
  }
  return true;
}

// Check if title column exists on books
async function checkTitleColumn() {
  const { data, error } = await supabase
    .from('books')
    .select('id, title')
    .limit(1);
  
  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('title')) {
      return false;
    }
    console.error('Error checking title column:', error.message);
    return null;
  }
  return true;
}

async function main() {
  console.log('🔍 Checking database schema...\n');
  
  const hasChapters = await checkChaptersTable();
  const hasLanguage = await checkLanguageColumn();
  const hasTitle = await checkTitleColumn();
  
  console.log(`chapters table: ${hasChapters === true ? '✅ Exists' : hasChapters === false ? '❌ Missing' : '⚠️ Error'}`);
  console.log(`books.language: ${hasLanguage === true ? '✅ Exists' : hasLanguage === false ? '❌ Missing' : '⚠️ Error'}`);
  console.log(`books.title: ${hasTitle === true ? '✅ Exists' : hasTitle === false ? '❌ Missing' : '⚠️ Error'}`);
  
  const needsMigration = hasChapters === false || hasLanguage === false || hasTitle === false;
  
  if (needsMigration) {
    console.log('\n❌ MIGRATION REQUIRED');
    console.log('\nPlease run the following SQL in Supabase SQL Editor:');
    console.log(`https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql\n`);
    console.log('─'.repeat(60));
    console.log(`
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

-- Migration 006: Add book metadata
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

-- Ensure mock user exists
insert into public.users (id, email, credits)
values ('00000000-0000-0000-0000-000000000001', 'mock@ekithab.local', 500)
on conflict (id) do nothing;
    `);
    console.log('─'.repeat(60));
    console.log('\n✅ After running SQL:');
    console.log('1. Restart backend: cd server && node src/index.js');
    console.log('2. Hard refresh browser (Cmd+Shift+R)');
    console.log('3. Try uploading a book again');
  } else {
    console.log('\n✅ All migrations applied! Database is up to date.');
  }
}

main().catch(console.error);
