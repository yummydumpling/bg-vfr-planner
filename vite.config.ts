import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH lets the same build run at a sub-path (e.g. GitHub Pages: /bg-vfr-planner/).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  server: { host: true },
  worker: { format: 'es' },
  preview: { host: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'BG VFR Planner',
        short_name: 'BG VFR',
        description: 'Supplementary VFR flight-planning aid for Bulgaria. Not for primary navigation.',
        lang: 'bg',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0f14',
        theme_color: '#0b2545',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + bundled aeronautical data are precached → works offline.
        globPatterns: ['**/*.{js,css,html,png,svg,json,geojson,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Base-map style, fonts and sprites
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(styles|fonts|sprites)\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'basemap-assets', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // TileJSON changes weekly (new tile version) → network first, cached fallback offline
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/planet$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'basemap-tilejson', networkTimeoutSeconds: 4 },
          },
          {
            // Vector/raster tiles: cached as you browse (no bulk download)
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(planet|natural_earth)\/.+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
