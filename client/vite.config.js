import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  console.log('[vite.config] mode:', mode);
  console.log('[vite.config] cwd:', process.cwd());
  console.log('[vite.config] VITE_API_URL:', env.VITE_API_URL);
  console.log('[vite.config] VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('[vite.config] VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
  // Vite automatically exposes VITE_* vars via import.meta.env
  // Just validate and provide fallbacks
  const apiUrl = env.VITE_API_URL || 'https://vernacular-audiobook-production.up.railway.app';
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://znhhavbeqxoydojywttu.supabase.co';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseKey) {
    console.warn('[vite.config] WARNING: Supabase anon key missing');
  }
  if (apiUrl.includes('localhost')) {
    console.warn('[vite.config] WARNING: VITE_API_URL points to localhost');
  }
  return {
    plugins: [react()],
    server: {
      port: 5175,
      strictPort: true,
      historyApiFallback: true,
    },
  };
});