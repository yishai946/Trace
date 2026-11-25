import { createDb } from '../db';
import { loadEnv } from '../env';
import { createPhotoStorage } from '../storage';
import { movePhotos } from '../storage/movePhotos';

const env = loadEnv();
if (!env.BUCKET_ENDPOINT) throw new Error('Set the BUCKET_* variables: the photos would only be copied to memory');
const database = createDb(env.DATABASE_URL);
try {
  const moved = await movePhotos(database.db, createPhotoStorage(env));
  console.info(`Moved ${moved} photos to the bucket.`);
} finally {
  await database.close();
}
