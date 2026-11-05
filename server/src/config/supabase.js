import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'audiobook';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[FATAL] Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Railway dashboard.');
  console.error('[FATAL] Server cannot start without Supabase credentials.');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    websocket: WebSocket,
  },
});

export const AUDIO_BUCKET = bucketName;
