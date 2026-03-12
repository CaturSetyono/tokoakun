// Quick Supabase connection test + schema runner
// Usage: node scripts/setup-db.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

config({ path: '.env' });

const __dir = dirname(fileURLToPath(import.meta.url));

const url = process.env.PUBLIC_SUPABASE_URL;
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('❌ Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

// ── 1. Test basic connectivity ───────────────────────────────────
console.log('🔍 Testing connection to:', url);
const client = createClient(url, serviceKey || anonKey);

const { error: pingError } = await client.from('users').select('count', { count: 'exact', head: true });

if (pingError && pingError.code !== 'PGRST116' && pingError.message?.includes('relation') === false) {
  // PGRST116 = table not found — that's expected if schema not run yet
  console.log('⚠️  Connection error (may just mean tables don\'t exist yet):', pingError.message);
} else {
  console.log('✅ Supabase connection successful!');
}

// ── 2. Check if tables exist ────────────────────────────────────
const tables = ['users', 'accounts', 'orders', 'order_items'];
const missing = [];

for (const table of tables) {
  const { error } = await client.from(table).select('count', { count: 'exact', head: true });
  if (error?.message?.toLowerCase().includes('relation') || error?.message?.toLowerCase().includes('does not exist')) {
    missing.push(table);
  } else {
    console.log(`  ✅ Table "${table}" exists`);
  }
}

if (missing.length > 0) {
  console.log(`\n⚠️  Missing tables: ${missing.join(', ')}`);

  if (!serviceKey) {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To run the schema automatically, add your service role key:

  SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← from Supabase Dashboard
                                        Settings → API → service_role

Then re-run: node scripts/setup-db.mjs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Or run the schema manually:
  Supabase Dashboard → SQL Editor → paste contents of supabase/schema.sql
`);
    process.exit(0);
  }

  // ── 3. Run schema using Management API ─────────────────────────
  console.log('\n🛠  Running schema via Supabase Management API ...');

  const projectRef = url.replace('https://', '').replace('.supabase.co', '');
  const schemaSQL = readFileSync(join(__dir, '../supabase/schema.sql'), 'utf-8');

  // Split on statement boundaries — send via Management API /database/query
  const managementEndpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  // The Management API needs a Supabase personal access token, NOT the service role key.
  // Service role key is used for data API only.
  // As a fallback, use the pg REST trick via the /rpc endpoint is not available for DDL.
  // Instead, we use the service role to call the exec_sql RPC if the user has created it.

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service role key found — but DDL requires running SQL directly.

Please run the schema in Supabase Dashboard:
  1. Go to: ${url.replace('.supabase.co', '')}.supabase.co
  2. SQL Editor → New query
  3. Paste: supabase/schema.sql   (${join(__dir, '../supabase/schema.sql')})
  4. Click Run

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
} else {
  console.log('\n🎉 All tables exist. Database is ready!');

  // Quick smoke test — try inserting nothing
  const { count } = await client.from('accounts').select('count', { count: 'exact', head: true });
  console.log(`  accounts: ${count ?? 0} rows`);
}
