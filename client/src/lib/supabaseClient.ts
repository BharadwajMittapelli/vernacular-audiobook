import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ponytail: minimal client config for stability; session persistence handled by Supabase default
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
