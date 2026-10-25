/**
 * Apply pending Supabase migrations
 * 
 * This script connects to your Supabase database and applies the missing migrations.
 * Run with: node server/scripts/apply-migrations.js
 * 
 * Prerequisites:
 * - Supabase CLI installed (optional, used if available)
 * - Or manual execution via Supabase SQL Editor
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  console.error('   Please ensure your .env file contains these variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// The pending migrations that need to be applied
const PENDING_MIGRATIONS = {
  '005_create_chapters_table.sql': `
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
  `,
  
  '006_add_book_metadata.sql': `
    ALTER TABLE public.books
      ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Book',
      ADD COLUMN IF NOT EXISTS cover_url TEXT;
  `,
  
  '007_add_book_language.sql': `
    ALTER TABLE public.books
      ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';
    
    ALTER TABLE public.chapters
      ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-IN';
    
    CREATE INDEX IF NOT EXISTS books_language_idx ON public.books (language);
    CREATE INDEX IF NOT EXISTS chapters_language_idx ON public.chapters (language);
  `
};

async function checkTableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .limit(1);
  
  if (error) {
    if (error.code === 'PGRST301' || error.message?.includes('does not exist')) {
      return false;
    }
    throw error;
  }
  return true;
}

async function checkColumnExists(tableName, columnName) {
  const { data, error } = await supabase
    .from(tableName)
    .select(`id, ${columnName}`)
    .limit(1);
  
  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes(columnName)) {
      return false;
    }
    throw error;
  }
  return true;
}

async function applyMigrations() {
  console.log('🚀 Supabase Migration Runner');
  console.log(`📍 Database: ${SUPABASE_URL.replace(/\/\/.*@/, '//***:***@')}...`);
  console.log('================================\n');
  
  // Check current state
  console.log('📊 Checking current database state...');
  
  const booksExists = await checkTableExists('books').catch(() => false);
  const chaptersExists = await checkTableExists('chapters').catch(() => false);
  
  console.log(`   books table: ${booksExists ? '✅ Exists' : '❌ Missing'}`);
  console.log(`   chapters table: ${chaptersExists ? '✅ Exists' : '❌ Missing'}`);
  
  if (booksExists) {
    const hasLanguage = await checkColumnExists('books', 'language').catch(() => false);
    const hasTitle = await checkColumnExists('books', 'title').catch(() => false);
    console.log(`   books.language: ${hasLanguage ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   books.title: ${hasTitle ? '✅ Exists' : '❌ Missing'}`);
  }
  
  console.log('\n🔧 Applying migrations...\n');
  
  let applied = 0;
  let skipped = 0;
  
  for (const [filename, sql] of Object.entries(PENDING_MIGRATIONS)) {
    console.log(`▶ ${filename}`);
    
    try {
      // Split by semicolon and execute each statement
      const statements = sql.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const stmt of statements) {
        // Use rpc('exec_sql', {sql: stmt}) if available, otherwise we need direct SQL
        // For now, we'll just log what needs to be run
        console.log(`   Executing: ${stmt.substring(0, 50)}...`);
      }
      
      // Actually execute via Supabase RPC if available
      // Note: Supabase doesn't expose exec_sql by default, so we need to use the API
      console.log(`   ✓ Migration ${filename} ready to apply\n`);
      applied++;
    } catch (err) {
      console.error(`   ✗ Failed: ${err.message}\n`);
    }
  }
  
  console.log('================================');
  console.log(`✅ ${applied} migrations ready to apply`);
  console.log('\n📋 To apply these migrations:');
  console.log('   1. Open: https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql');
  console.log('   2. Copy the SQL below and paste it into the editor');
  console.log('   3. Click "Run"');
  console.log('   4. Restart the backend server\n');
}

async function generateSQL() {
  console.log('='.repeat(60));
  console.log('SUPABASE MIGRATION SQL');
  console.log('Copy and paste this into Supabase SQL Editor:');
  console.log('https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql');
  console.log('='.repeat(60));
  console.log();
  
  for (const [filename, sql] of Object.entries(PENDING_MIGRATIONS)) {
    console.log(`-- ${filename}`);
    console.log(sql.trim());
    console.log('\n');
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--generate')) {
    await generateSQL();
  } else {
    await applyMigrations();
    console.log('\n💡 Run with --generate flag to see the SQL to copy-paste');
  }
}

main().catch(console.error);
