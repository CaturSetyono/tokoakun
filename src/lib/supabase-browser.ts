import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY as string;

// Browser client: stores session in cookies (accessible by server middleware)
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
);
