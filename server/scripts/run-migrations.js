/**
 * Direct Supabase Migration Runner
 * Uses service role key to apply migrations
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
  console.error('❌ Missing Supabase credentials in server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration(sql, name) {
  console.log(`\n▶ ${name}`);
  try {
    // Supabase REST API doesn't support raw SQL execution directly
    // We need to use the PostgREST RPC or admin API
    // For now, we'll output the SQL for manual execution
    console.log(`   SQL ready (see output below)`);
    return true;
  } catch (err) {
    console.error(`   ✗ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('SUPABASE MIGRATION RUNNER');
  console.log('='.repeat(60));
  
  const migrations = [
    {
      name: '005_create_chapters_table.sql',
      sql: `
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

alter table public.chapters enable row level security;`
    },
    {
      name: '006_add_book_metadata.sql',
      sql: `
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Book',
  ADD COLUMN IF NOT EXISTS cover_url TEXT;`
    },
    {
      name: '007_add_book_language.sql',
      sql: `
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';

CREATE INDEX IF NOT EXISTS books_language_idx ON public.books (language);
CREATE INDEX IF NOT EXISTS chapters_language_idx ON public.chapters (language);`
    },
    {
      name: 'Ensure mock user exists',
      sql: `
insert into public.users (id, email, credits)
values ('00000000-0000-0000-0000-000000000001', 'mock@ekithab.local', 500)
on conflict (id) do nothing;`
    }
  ];
  
  console.log('\n📋 COPY AND PASTE THIS SQL INTO SUPABASE SQL EDITOR:\n');
  console.log(`https://app.supabase.com/project/${SUPABASE_URL.split('//')[1].split('.')[0]}/sql\n`);
  console.log('='.repeat(60));
  
  for (const migration of migrations) {
    console.log(`\n-- ${migration.name}`);
    console.log(migration.sql.trim());
    console.log(';\n');
  }
  
  console.log('='.repeat(60));
  console.log('\n✅ Instructions:');
  console.log('1. Open the URL above');
  console.log('2. Copy all SQL above and paste into the editor');
  console.log('3. Click "Run"');
  console.log('4. Wait for success message');
  console.log('5. Restart backend: cd server && node src/index.js');
  console.log('='.repeat(60));
}

main().catch(console.error);
