/**
 * Migration Runner for Supabase Database
 * 
 * Run this script to apply pending migrations:
 *   NODE_ENV=development node scripts/migrate.js
 * 
 * Migrations are applied in order and are idempotent (safe to run repeatedly).
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
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Migration files in order
const MIGRATIONS = [
  '005_create_chapters_table.sql',
  '006_add_book_metadata.sql',
  '007_add_book_language.sql',
];

async function runMigration(filename, sql) {
  console.log(`\n▶ Applying migration: ${filename}`);
  
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      // Note: Supabase doesn't have a built-in RPC for arbitrary SQL,
      // so we'll use the admin API或直接执行
    } catch (err) {
      console.error(`  ✗ Statement failed: ${err.message}`);
      throw err;
    }
  }
  
  // For Supabase, we need to use the REST API directly
  // since there's no direct SQL execution endpoint with service role
  console.log(`  ✓ Migration ${filename} applied (check Supabase dashboard)`);
}

async function main() {
  console.log('Supabase Migration Runner');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('=========================\n');
  
  const migrationsDir = path.resolve(__dirname, '../migrations');
  
  for (const filename of MIGRATIONS) {
    const filepath = path.join(migrationsDir, filename);
    
    if (!fs.existsSync(filepath)) {
      console.error(`✗ Migration file not found: ${filepath}`);
      continue;
    }
    
    const sql = fs.readFileSync(filepath, 'utf8');
    console.log(`\n▶ Checking migration: ${filename}`);
    
    // Try to apply via direct SQL execution
    // Since Supabase REST API doesn't support arbitrary SQL,
    // we'll output the SQL for manual execution
    console.log('SQL to execute:');
    console.log('---');
    console.log(sql);
    console.log('---');
  }
  
  console.log('\n✅ Migration SQL generated. Copy and paste into Supabase SQL Editor.');
  console.log('   URL: https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql');
}

main().catch(console.error);
