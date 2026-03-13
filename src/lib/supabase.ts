import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables (SUPABASE_URL or SUPABASE_KEY) are missing.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
