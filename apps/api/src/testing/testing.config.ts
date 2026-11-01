import { LOCAL_DATABASE_URL } from '../env';

/** Tests use their own database next to the development one, so running them never touches dev data. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? LOCAL_DATABASE_URL.replace(/\/trace$/, '/trace_test');
