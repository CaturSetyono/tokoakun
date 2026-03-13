import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Local Supabase Postgres default connection
const sql = postgres('postgresql://postgres:postgres@127.0.0.1:54322/postgres');

async function migrate() {
  console.log('🚀 Starting migration...');
  const migrationPath = join(__dirname, '../supabase/auth_migration.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');

  try {
    // Split the SQL into individual statements if necessary, 
    // but the 'postgres' package can handle multi-statement strings.
    await sql.unsafe(migrationSql);
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
