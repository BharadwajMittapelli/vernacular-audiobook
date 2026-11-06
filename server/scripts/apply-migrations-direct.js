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
const MIGRATIONS = {
  '009_create_downloads_table': {
    sql: `
      -- Migration 009: Create downloads table
      create table if not exists public.downloads (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references public.users(id) on delete cascade,
        book_id uuid not null references public.books(id) on delete cascade,
        chapter_id uuid references public.chapters(id) on delete cascade,
        audio_url text not null,
        created_at timestamptz not null default now(),
        status text not null default 'pending'
      );
      
      create index if not exists downloads_user_id_idx on public.downloads (user_id);
      create index if not exists downloads_book_id_idx on public.downloads (book_id);
      
      alter table public.downloads enable row level security;
    `,
    description: 'Create downloads table for tracking audio downloads'
  },
  '011_create_playback_history': {
    sql: `
      -- Migration 011: Create playback history table
      create table if not exists public.playback_history (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references public.users(id) on delete cascade,
        book_id uuid not null references public.books(id) on delete cascade,
        chapter_id uuid not null references public.chapters(id) on delete cascade,
        position_seconds integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      
      create index if not exists playback_history_user_id_idx on public.playback_history (user_id);
      create index if not exists playback_history_book_id_idx on public.playback_history (book_id);
      create index if not exists playback_history_chapter_id_idx on public.playback_history (chapter_id);
      
      alter table public.playback_history enable row level security;
    `,
    description: 'Create playback history table for tracking user progress'
  },
  '012_create_favorites': {
    sql: `
      -- Migration 012: Create favorites table
      create table if not exists public.favorites (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references public.users(id) on delete cascade,
        book_id uuid not null references public.books(id) on delete cascade,
        created_at timestamptz not null default now()
      );
      
      create unique index if not exists favorites_user_id_book_id_idx on public.favorites (user_id, book_id);
      
      alter table public.favorites enable row level security;
    `,
    description: 'Create favorites table for user bookmarks'
  },
  '014_add_chapter_normalization': {
    sql: `
      -- Migration 014: Add chapter normalization flag
      alter table public.chapters
        add column if not exists normalized boolean not null default false;
      
      create index if not exists chapters_normalized_idx on public.chapters (normalized);
    `,
    description: 'Add chapter normalization flag for JIT transcript optimization'
  }
};

async function applyMigrations() {
  console.log('🚀 Applying Supabase migrations...');
  console.log(`📍 Database: ${SUPABASE_URL.replace(/\/\/.*@/, '//***:***@')}...`);
  console.log('================================\n');

  try {
    // Apply each migration
    for (const [name, migration] of Object.entries(MIGRATIONS)) {
      console.log(`🔧 Applying migration ${name}: ${migration.description}`);
      console.log('SQL:\n' + migration.sql.trim() + '\n');

      const { error } = await supabase.rpc('execute_sql', {
        sql: migration.sql
      });

      if (error) {
        console.error(`❌ Error applying migration ${name}:`, error.message);
        console.log('SQL that failed:\n' + migration.sql);
        process.exit(1);
      } else {
        console.log(`✅ Successfully applied migration ${name}\n`);
      }
    }

    console.log('\n✅ All migrations applied successfully!');
  } catch (err) {
    console.error('❌ Error applying migrations:', err.message);
    process.exit(1);
  }
}

applyMigrations();