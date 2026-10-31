import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const port = Number(process.env.WEB_PORT ?? 5173);
// 127.0.0.1 instead of localhost: on Windows "localhost" tries IPv6 first and the API listens on IPv4.
const apiTarget = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  // MAPTILER_ variables reach the browser: the MapTiler key is a public, domain-restricted client key.
  envPrefix: ['VITE_', 'MAPTILER_'],
  // The MapLibre worker is bundled as an ES module worker (see src/map/maplibre-worker.ts).
  worker: { format: 'es' },
  server: { port, strictPort: true, proxy: { '/api': apiTarget } },
  preview: { port, strictPort: true, proxy: { '/api': apiTarget } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], css: false },
});
