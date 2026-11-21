import { fileURLToPath } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json' with { type: 'json' };
import { sourceMapUploadOptions } from './build/sourceMapUpload';

const port = Number(process.env.WEB_PORT ?? 5173);
// 127.0.0.1 instead of localhost: on Windows "localhost" tries IPv6 first and the API listens on IPv4.
const apiTarget = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3001';

const distDir = fileURLToPath(new URL('./dist', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Last, so it sees the final bundle: uploads the hidden maps and deletes them when SENTRY_AUTH_TOKEN is set.
    sentryVitePlugin(
      sourceMapUploadOptions(loadEnv(mode, process.cwd(), ['VITE_SENTRY_', 'SENTRY_']), {
        version: packageJson.version,
        distDir,
      }),
    ),
  ],
  // MAPTILER_ variables reach the browser: the MapTiler key is a public, domain-restricted client key.
  envPrefix: ['VITE_', 'MAPTILER_'],
  // Source maps are built for Sentry but not referenced from the files served to browsers (docs/MONITORING.md).
  build: { sourcemap: 'hidden' },
  // The MapLibre worker is bundled as an ES module worker (see src/map/maplibre-worker.ts).
  worker: { format: 'es' },
  // ws: the realtime channel (Socket.IO) upgrades to a WebSocket under /api/realtime.
  server: { port, strictPort: true, proxy: { '/api': { target: apiTarget, ws: true } } },
  preview: { port, strictPort: true, proxy: { '/api': { target: apiTarget, ws: true } } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], css: false },
}));
