import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Registered from src/main.tsx, and only in the browser: Electron loads the build over file://,
      // where service workers can't run
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'TVR Studio',
        short_name: 'TVR Studio',
        description: 'Download YouTube and SoundCloud audio and video as MP3 / MP4',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F8FAFC',
        theme_color: '#2563EB',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'music.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The download server answers these; never serve the cached app shell instead
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
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
  // ffmpeg.wasm starts its own worker, which Vite's dependency pre-bundling would break
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
