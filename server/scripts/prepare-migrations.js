/**
 * Supabase Migration Helper
 * 
 * This script outputs the SQL that needs to be run in the Supabase SQL Editor.
 * All migrations use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so they are safe to run repeatedly.
 * 
 * Usage:
 *   node server/scripts/prepare-migrations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
  '005_create_chapters_table.sql',
  '006_add_book_metadata.sql',
  '007_add_book_language.sql',
];

function main() {
  console.log('='.repeat(60));
  console.log('SUPABASE MIGRATION SQL');
  console.log('Copy and paste the following into Supabase SQL Editor:');
  console.log('https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql');
  console.log('='.repeat(60));
  
  const migrationsDir = path.resolve(__dirname, '../migrations');
  let combined = '';
  
  for (const filename of MIGRATIONS) {
    const filepath = path.join(migrationsDir, filename);
    
    if (!fs.existsSync(filepath)) {
      console.error(`\n✗ Migration file not found: ${filepath}`);
      continue;
    }
    
    const sql = fs.readFileSync(filepath, 'utf8').trim();
    combined += `\n-- =============================================\n`;
    combined += `-- ${filename}\n`;
    combined += `-- =============================================\n${sql}\n\n`;
  }
  
  console.log(combined);
  
  // Also save to file
  const outputFile = path.resolve(__dirname, '../migrations/pending.sql');
  fs.writeFileSync(outputFile, combined, 'utf8');
  console.log(`\n✅ Saved to: ${outputFile}`);
  console.log('\nInstructions:');
  console.log('1. Open https://app.supabase.com/project/sgpkxgwnxusjagjnesir/sql');
  console.log('2. Paste the SQL above');
  console.log('3. Click "Run"');
  console.log('4. Restart the backend server');
}

main();
