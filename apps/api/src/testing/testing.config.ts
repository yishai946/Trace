import { LOCAL_DATABASE_URL } from '../env';

/** Tests use their own database next to the development one, so running them never touches dev data. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? LOCAL_DATABASE_URL.replace(/\/trace$/, '/trace_test');

/** The bucket variables a production environment must have. Tests that load a production env spread these in. */
export const TEST_BUCKET_ENV = {
  BUCKET_ENDPOINT: 'https://bucket.example.net',
  BUCKET_NAME: 'trace-test',
  BUCKET_ACCESS_KEY_ID: 'key',
  BUCKET_SECRET_ACCESS_KEY: 'secret',
};
