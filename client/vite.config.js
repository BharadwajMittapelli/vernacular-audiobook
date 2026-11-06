import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // ponytail: fail the build instead of shipping a blank white page (createClient('') throws at module load)
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Build aborted: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are empty');
  }
  if (!env.VITE_API_URL || env.VITE_API_URL.includes('localhost')) {
    throw new Error('Build aborted: VITE_API_URL must be the deployed API origin');
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
