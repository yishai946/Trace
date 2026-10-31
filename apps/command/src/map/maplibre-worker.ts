import { setWorkerUrl } from 'maplibre-gl';
// MapLibre v6 locates its worker with a URL built at runtime, which Vite cannot see at build time.
// Importing it through Vite bundles the worker (with its shared chunk) and gives a URL that works in dev and build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
