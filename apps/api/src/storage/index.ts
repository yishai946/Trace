import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../env';
import { createBucketStorage } from './bucket';
import { createMemoryStorage } from './memory';

export interface StoredPhoto {
  contentType: string;
  data: Buffer;
}

/** Where photos live. The API is the only way to a photo: nothing hands a client the bucket's address. */
export interface PhotoStorage {
  /** Saves the photo, replacing the one under the same key. */
  put(key: string, photo: StoredPhoto): Promise<void>;
  /** `null` when there is none under the key. */
  get(key: string): Promise<StoredPhoto | null>;
  /** Deleting a key that does not exist is not an error. */
  remove(key: string): Promise<void>;
}

export const missionPhotoKey = (missionId: string) => `missions/${missionId}/photo`;
export const reportPhotoKey = (reportId: string) => `reports/${reportId}/photo`;

/**
 * A photo kept in its table row before photos moved to the bucket still has its bytes there until `photos:move` copies
 * it. It is served from the row meanwhile, so no photo is missing during the move. `null` when there is none.
 */
export async function readPhoto(
  photos: PhotoStorage,
  key: string,
  row: { contentType: string; data: Buffer | null },
): Promise<StoredPhoto | null> {
  return row.data ? { contentType: row.contentType, data: row.data } : photos.get(key);
}

/** The Railway Bucket when its variables are set; otherwise memory, which `loadEnv` allows outside production only. */
export function createPhotoStorage(env: Env): PhotoStorage {
  const { BUCKET_ENDPOINT, BUCKET_NAME, BUCKET_ACCESS_KEY_ID, BUCKET_SECRET_ACCESS_KEY } = env;
  if (!BUCKET_ENDPOINT || !BUCKET_NAME || !BUCKET_ACCESS_KEY_ID || !BUCKET_SECRET_ACCESS_KEY) {
    return createMemoryStorage();
  }
  // Railway's endpoint uses virtual-hosted URLs, which is the SDK's default style.
  const client = new S3Client({
    endpoint: BUCKET_ENDPOINT,
    region: env.BUCKET_REGION,
    // Only send a checksum when the store asks for one: other S3-compatible stores (R2) reject the SDK newer default.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: BUCKET_ACCESS_KEY_ID, secretAccessKey: BUCKET_SECRET_ACCESS_KEY },
  });
  return createBucketStorage(BUCKET_NAME, client);
}
