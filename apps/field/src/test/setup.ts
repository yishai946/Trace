import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import * as secureStore from './secureStore';
import * as sqlite from './sqlite';

// SecureStore has no web implementation; tests use an in-memory one.
vi.mock('expo-secure-store', () => import('./secureStore'));
// expo-crypto pulls in the native Expo runtime; tests use the platform's Web Crypto.
vi.mock('expo-crypto', () => ({
  getRandomValues: <T extends ArrayBufferView<ArrayBuffer>>(array: T): T => globalThis.crypto.getRandomValues(array),
}));
// expo-sqlite is native only; tests use an in-memory database on node:sqlite.
vi.mock('expo-sqlite', () => import('./sqlite'));

// expo-battery is native only; by default the level is unknown (-1), so nothing is reported.
vi.mock('expo-battery', () => ({ getBatteryLevelAsync: async () => -1 }));

// `findBy*` and `waitFor` give up after 1 s by default. A full `pnpm check` runs every package's tests at once, and
// on a loaded machine the first render of a screen (location fix, database, queries) can take longer than that.
// The limit only matters when a test fails; a passing test still finishes as soon as its condition holds.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  sqlite.reset();
  secureStore.secureStoreItems.clear();
  secureStore.getItemAsync.mockClear();
  secureStore.setItemAsync.mockClear();
  secureStore.deleteItemAsync.mockClear();
});

// jsdom has no matchMedia; react-native-web reads the device color scheme through it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
