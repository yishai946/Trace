import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../env';
import { logAndReport, type ErrorLogger } from '../monitoring';
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

/**
 * Every version of a photo has its own key (`version` is the row's `updatedAt`), so an upload never overwrites the
 * object the row points at: if its transaction fails, the old photo is still what is served.
 */
export const missionPhotoKey = (missionId: string, version: Date) => `missions/${missionId}/photo-${version.getTime()}`;
export const reportPhotoKey = (reportId: string, version: Date) => `reports/${reportId}/photo-${version.getTime()}`;

/** The version of a new upload: now, and always later than the one it replaces, so the two keys differ. */
export const nextPhotoVersion = (previous: Date | undefined) =>
  new Date(Math.max(Date.now(), (previous?.getTime() ?? 0) + 1));

/**
 * Deletes an object no row points at any more. The change is committed already, so a failure leaves an unused object
 * behind and is logged and reported, not an error for the user.
 */
export async function discardPhoto(photos: PhotoStorage, log: ErrorLogger, key: string): Promise<void> {
  await photos
    .remove(key)
    .catch((error: unknown) =>
      logAndReport(log, error, { source: 'storage.discard', message: 'Old photo not deleted', fields: { key } }),
    );
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
    // A slow or silent bucket must not hold a mission lock or a database connection for long: fail after a few seconds.
    requestHandler: { connectionTimeout: 3000, requestTimeout: 8000 },
    maxAttempts: 2,
    credentials: { accessKeyId: BUCKET_ACCESS_KEY_ID, secretAccessKey: BUCKET_SECRET_ACCESS_KEY },
  });
  return createBucketStorage(BUCKET_NAME, client);
}
