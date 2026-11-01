import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/testing/testing.setup.ts'],
    // The test files share one database, so they run one after another.
    fileParallelism: false,
  },
});
