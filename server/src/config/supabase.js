import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'audiobook';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[FATAL] Missing Supabase environment variables.');
  process.exit(1);
}

// Simple client without realtime to avoid WebSocket issues on Node 18
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const AUDIO_BUCKET = bucketName;
