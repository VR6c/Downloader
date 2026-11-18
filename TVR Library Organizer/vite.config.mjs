import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [
    react(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  base: './',
  server: {
    port: 5173,
    strictPort: false,
    // Browser dev: `uvicorn api.index:app --port 8000` serves the download API (see README)
    proxy: {
      '/api': process.env.TVR_API_URL || 'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
