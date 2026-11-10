import { defineConfig } from 'vitest/config';

// Components render through react-native-web in jsdom, so tests query them by role and label like the web app.
// `.web` files win, which also picks the web fallback of native-only modules such as the MapLibre map.
export default defineConfig({
  resolve: {
    mainFields: ['module', 'main'],
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      {
        find: '@react-native/assets-registry/registry',
        replacement: new URL('./src/test/assetsRegistry.ts', import.meta.url).pathname,
      },
    ],
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js', '.mjs', '.json'],
  },
  define: { __DEV__: 'true', 'process.env.EXPO_OS': '"web"' },
  test: {
    server: { deps: { inline: ['react-native-svg'] } },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: { EXPO_PUBLIC_API_URL: 'https://api.test' },
  },
});
