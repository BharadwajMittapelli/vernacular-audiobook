import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  console.log('[vite.config] cwd:', process.cwd());
  console.log('[vite.config] VITE_API_URL:', env.VITE_API_URL);
  console.log('[vite.config] VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('[vite.config] VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.warn('[vite.config] WARNING: Supabase env vars missing, continuing anyway');
  }
  if (!env.VITE_API_URL || env.VITE_API_URL.includes('localhost')) {
    console.warn('[vite.config] WARNING: VITE_API_URL missing or localhost, continuing anyway');
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
