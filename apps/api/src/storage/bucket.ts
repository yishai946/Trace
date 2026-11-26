import type { S3Client } from '@aws-sdk/client-s3';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import type { PhotoStorage } from '.';

/**
 * Photos in a bucket of an S3 client: a Railway Bucket, or any S3-compatible store (Cloudflare R2 needs only other
 * settings). The bucket is private; the client's endpoint and credentials come from `createPhotoStorage`.
 */
export function createBucketStorage(bucket: string, client: S3Client): PhotoStorage {
  return {
    async put(key, { contentType, data }) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
    },
    async get(key) {
      try {
        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!object.Body) return null;
        return {
          contentType: object.ContentType ?? 'application/octet-stream',
          data: Buffer.from(await object.Body.transformToByteArray()),
        };
      } catch (error) {
        if (error instanceof S3ServiceException && error.name === 'NoSuchKey') return null;
        throw error;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
