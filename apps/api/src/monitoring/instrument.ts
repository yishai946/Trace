import { loadEnv } from '../env';
import { initMonitoring } from '.';

// Loaded with `--import` before the server, so Sentry can instrument modules as they load.
initMonitoring(loadEnv());
