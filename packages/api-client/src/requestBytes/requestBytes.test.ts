import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../ApiRequestError';
import { requestBytes } from './index';

describe('requestBytes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the bytes and the content type of a successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    );
    const photo = await requestBytes('/api/photo', { headers: { authorization: 'Bearer t' } });
    expect(Array.from(photo.bytes)).toEqual([1, 2, 3]);
    expect(photo.contentType).toBe('image/jpeg');
  });

  it('fails with the error the server answered with', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No photo' } }), { status: 404 }),
    );
    await expect(requestBytes('/api/photo')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('fails with a network error when the server is not reachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await expect(requestBytes('/api/photo')).rejects.toBeInstanceOf(ApiRequestError);
  });
});
