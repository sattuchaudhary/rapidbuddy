import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  define: {
    'process.env': {}
  },
  server: {
    host: 'rapidbudy.cloud',
    port: 3000,
    strictPort: true,
    open: false,
    proxy: {
      '/api': {
        target: 'https://rapidbudy.cloud',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: 'build',
    sourcemap: false
  }
});



