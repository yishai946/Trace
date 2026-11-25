import { S3Client } from '@aws-sdk/client-s3';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBucketStorage } from './bucket';

/** A stand-in for S3: keeps what is PUT under `/<bucket>/<key>` and answers like S3 when a key is missing. */
function startFakeS3() {
  const objects = new Map<string, { type: string; body: Buffer }>();
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const path = decodeURIComponent((request.url ?? '').split('?')[0] ?? '');
      if (request.method === 'PUT') {
        objects.set(path, { type: String(request.headers['content-type']), body: Buffer.concat(chunks) });
        return response.writeHead(200).end();
      }
      if (request.method === 'DELETE') {
        objects.delete(path);
        return response.writeHead(204).end();
      }
      const object = objects.get(path);
      if (!object) {
        return response
          .writeHead(404, { 'content-type': 'application/xml' })
          .end('<Error><Code>NoSuchKey</Code><Message>missing</Message></Error>');
      }
      return response.writeHead(200, { 'content-type': object.type }).end(object.body);
    });
  });
  return { server, objects };
}

const closeServer = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

describe('bucket photo storage', () => {
  const fake = startFakeS3();
  let storage: ReturnType<typeof createBucketStorage>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => fake.server.listen(0, '127.0.0.1', resolve));
    const address = fake.server.address() as AddressInfo;
    const client = new S3Client({
      endpoint: `http://127.0.0.1:${address.port}`,
      region: 'auto',
      forcePathStyle: true,
      credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    storage = createBucketStorage('photos', client);
  });
  afterAll(() => closeServer(fake.server));

  it('saves a photo with its type, reads it back and replaces it under the same key', async () => {
    await storage.put('missions/1/photo', { contentType: 'image/png', data: Buffer.from([1, 2, 3]) });
    expect(fake.objects.get('/photos/missions/1/photo')?.body).toEqual(Buffer.from([1, 2, 3]));
    expect(await storage.get('missions/1/photo')).toEqual({ contentType: 'image/png', data: Buffer.from([1, 2, 3]) });
    await storage.put('missions/1/photo', { contentType: 'image/jpeg', data: Buffer.from([9]) });
    expect(await storage.get('missions/1/photo')).toEqual({ contentType: 'image/jpeg', data: Buffer.from([9]) });
  });

  it('answers null for a key that does not exist and deletes without complaint', async () => {
    expect(await storage.get('reports/none/photo')).toBeNull();
    await storage.put('reports/2/photo', { contentType: 'image/png', data: Buffer.from([4]) });
    await storage.remove('reports/2/photo');
    expect(await storage.get('reports/2/photo')).toBeNull();
    await expect(storage.remove('reports/2/photo')).resolves.toBeUndefined();
  });
});
