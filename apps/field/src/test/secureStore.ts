import { vi } from 'vitest';

/** An in-memory stand-in for expo-secure-store, which has no web implementation. */
export const secureStoreItems = new Map<string, string>();

export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';

export const getItemAsync = vi.fn(async (key: string) => secureStoreItems.get(key) ?? null);
export const setItemAsync = vi.fn(async (key: string, value: string) => {
  secureStoreItems.set(key, value);
});
export const deleteItemAsync = vi.fn(async (key: string) => {
  secureStoreItems.delete(key);
});
