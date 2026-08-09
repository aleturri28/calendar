import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // In sviluppo il cookie di sessione vale per una sola origine,
    // esattamente come in produzione.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: { outDir: 'dist' },
});
