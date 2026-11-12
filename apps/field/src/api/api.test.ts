import { MissionPolygonList } from '@trace/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, ApiRequestError, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from '.';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('calls the API with the searcher token and validates the response', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', fetch);

    await expect(
      apiRequest('/missions/m1/polygons', { baseUrl: 'https://api.test', token: 't1', schema: MissionPolygonList }),
    ).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/missions/m1/polygons',
      expect.objectContaining({ method: 'GET', credentials: 'omit', headers: { authorization: 'Bearer t1' } }),
    );
  });

  it('uploads raw bytes with the given content type and the token', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', fetch);
    const data = new Uint8Array([0xff, 0xd8, 0xff]);

    await apiRequest('/missions/m1/reports/r1/photo', {
      baseUrl: 'https://api.test',
      token: 't1',
      method: 'PUT',
      upload: { contentType: 'image/jpeg', data },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/missions/m1/reports/r1/photo',
      expect.objectContaining({
        method: 'PUT',
        body: data,
        headers: { authorization: 'Bearer t1', 'content-type': 'image/jpeg' },
      }),
    );
  });

  it('sends no authorization header before sign-in', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', fetch);

    await apiRequest('/health', { baseUrl: 'https://api.test', token: null });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ headers: {} });
  });

  it('turns the shared error shape into an ApiRequestError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(404, { error: { code: 'NOT_FOUND', message: 'Mission not found' } })),
    );

    const error = await apiRequest('/missions/x', { baseUrl: 'https://api.test', token: 't1' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('reads Retry-After from a refused request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'TOO_MANY_OTP_REQUESTS' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '42' },
        }),
      ),
    );

    const error = await apiRequest('/x', { baseUrl: 'https://api.test', token: null }).catch((e) => e);
    expect(error).toMatchObject({ status: 429, code: 'INTERNAL_ERROR', retryAfter: 42 });
  });

  it('never sends cookies', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', fetch);

    await apiRequest('/health', { baseUrl: 'https://api.test', token: null });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' });
  });

  it('reports an unreachable server as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));

    await expect(apiRequest('/health', { baseUrl: 'https://api.test', token: null })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('fails clearly when the API address is not configured', async () => {
    await expect(apiRequest('/health', { baseUrl: undefined, token: null })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'EXPO_PUBLIC_API_URL is not set',
    });
  });

  /** A fetch that never answers but rejects when it is aborted, as the real one does. */
  const stalled = () =>
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        ),
    );

  it('turns a stalled request into a network error after the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stalled());

    const result = apiRequest('/x', { baseUrl: 'https://api.test', token: null }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await result).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('gives an upload more time than a plain request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stalled());

    const result = apiRequest('/x', {
      baseUrl: 'https://api.test',
      token: null,
      method: 'PUT',
      upload: { contentType: 'image/jpeg', data: new Uint8Array([1]) },
    }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    let settled = false;
    void result.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS - REQUEST_TIMEOUT_MS);
    expect(await result).toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('keeps the caller abort as an abort, not a network error', async () => {
    vi.stubGlobal('fetch', stalled());
    const controller = new AbortController();

    const result = apiRequest('/x', { baseUrl: 'https://api.test', token: null, signal: controller.signal }).catch(
      (e) => e,
    );
    controller.abort();
    expect(await result).not.toBeInstanceOf(ApiRequestError);
  });
});
