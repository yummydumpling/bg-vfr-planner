import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const git = (args: string, fallback: string) => {
  try { return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback; } catch { return fallback; }
};
const commit = git('rev-parse --short HEAD', 'dev');
// Commit time (not "now") so rebuilding the same commit gives identical files —
// the daily data check can redeploy without making every phone download an update.
const buildTime = new Date(git('log -1 --format=%cI', new Date().toISOString())).toISOString();

// BASE_PATH lets the same build run at a sub-path (e.g. GitHub Pages: /bg-vfr-planner/).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${commit}`),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    host: true,
    // Dev only: same API shape as the Cloudflare Worker in proxy/worker.js
    proxy: {
      '/wx': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/wx/, '/api/data'),
        headers: { 'User-Agent': 'BG-VFR-Planner-dev' },
      },
    },
  },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      // The app plus the static privacy notice and terms of use
      input: { main: 'index.html', privacy: 'privacy.html', terms: 'terms.html' },
    },
  },
  preview: { host: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from src/pwa/updates.ts, which controls when the page reloads.
      injectRegister: false,
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
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // App shell + bundled aeronautical data are precached → works offline.
        globPatterns: ['**/*.{js,css,html,png,svg,json,geojson,webmanifest}'],
        // status.json changes daily (data check time) and must not trigger an app update
        globIgnores: ['**/status.json'],
        navigateFallbackDenylist: [/\/(privacy|terms)\.html$/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Daily data-check status: fresh when online, last known when offline
            urlPattern: /\/data\/bg\/status\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'data-status', networkTimeoutSeconds: 4 },
          },
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
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'proxy/**/*.test.ts'],
  },
});
