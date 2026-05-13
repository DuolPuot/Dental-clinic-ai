import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: { '/trpc': 'http://localhost:4000' },
  },
  optimizeDeps: {
    // Force Vite to re-bundle deps on every cold start — eliminates stale cache issues
    force: true,
  },
});
