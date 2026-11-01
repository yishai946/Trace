import { HealthResponse } from '@trace/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiRequest } from '.';

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('apiRequest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('validates a successful response', async () => {
    respond(200, { status: 'ok', version: '1', time: '2026-11-01T00:00:00.000Z' });
    await expect(apiRequest('/health', { schema: HealthResponse })).resolves.toMatchObject({ status: 'ok' });
  });

  it('sends JSON bodies to /api', async () => {
    const fetch = respond(200, {});
    await apiRequest('/missions', { method: 'POST', body: { name: 'x' } });
    expect(fetch).toHaveBeenCalledWith(
      '/api/missions',
      expect.objectContaining({ method: 'POST', body: '{"name":"x"}' }),
    );
  });

  it('turns the shared error shape into an ApiRequestError', async () => {
    respond(409, { error: { code: 'POLYGON_HAS_ACTIVE_SEARCHERS', message: 'busy', details: { activeSearchers: 2 } } });
    const error = await apiRequest('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 409, code: 'POLYGON_HAS_ACTIVE_SEARCHERS', details: { activeSearchers: 2 } });
  });

  it('reports an unreachable server as a network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiRequest('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
