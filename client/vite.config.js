import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-radix': ['@radix-ui/react-select', '@radix-ui/react-slider', '@radix-ui/react-slot'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
