import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  console.log('[vite.config] mode:', mode);
  console.log('[vite.config] cwd:', process.cwd());
  console.log('[vite.config] VITE_API_URL:', env.VITE_API_URL);
  console.log('[vite.config] VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('[vite.config] VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
  console.log('[vite.config] process.env.VITE_API_URL:', process.env.VITE_API_URL);
  // Allow build to continue with fallbacks for CI/CD compatibility
  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || 'https://vernacular-audiobook-production.up.railway.app';
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://znhhavbeqxoydojywttu.supabase.co';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseKey) {
    console.warn('[vite.config] WARNING: Supabase anon key missing');
  }
  if (apiUrl.includes('localhost')) {
    console.warn('[vite.config] WARNING: VITE_API_URL points to localhost');
  }
  return {
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_FRONTEND_URL': JSON.stringify(env.VITE_FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://vernacular-audiobook.vercel.app'),
    },
    plugins: [react()],
    server: {
      port: 5175,
      strictPort: true,
      historyApiFallback: true,
    },
  };
});