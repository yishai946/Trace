import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import * as secureStore from './secureStore';

// SecureStore has no web implementation; tests use an in-memory one.
vi.mock('expo-secure-store', () => import('./secureStore'));

afterEach(() => {
  cleanup();
  secureStore.secureStoreItems.clear();
  secureStore.getItemAsync.mockClear();
  secureStore.setItemAsync.mockClear();
  secureStore.deleteItemAsync.mockClear();
});

// jsdom has no matchMedia; react-native-web reads the device color scheme through it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
