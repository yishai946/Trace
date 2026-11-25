import type { PhotoStorage, StoredPhoto } from '.';

/** Keeps photos in the process, for development without a bucket and for tests. They are gone when the server stops. */
export function createMemoryStorage(): PhotoStorage {
  const photos = new Map<string, StoredPhoto>();
  return {
    async put(key, photo) {
      photos.set(key, photo);
    },
    async get(key) {
      return photos.get(key) ?? null;
    },
    async remove(key) {
      photos.delete(key);
    },
  };
}
