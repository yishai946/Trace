import { HealthResponse } from '@trace/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../ApiRequestError';
import { request } from './index';

const respond = (status: number, body: unknown, headers?: Record<string, string>) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));

describe('request', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('validates a successful response with the schema', async () => {
    respond(200, { status: 'ok', version: '1', time: '2026-11-01T00:00:00.000Z' });
    await expect(request('/api/health', { schema: HealthResponse })).resolves.toMatchObject({ status: 'ok' });
  });

  it('returns undefined without a schema', async () => {
    respond(200, {});
    await expect(request('/api/x')).resolves.toBeUndefined();
  });

  it('resolves to undefined without a schema, even when the answer has a body', async () => {
    respond(200, { x: 1 });
    await expect(request('/api/x')).resolves.toBeUndefined();
  });

  it('passes the method, headers, body and credentials to fetch, and the caller signal when there is no timeout', async () => {
    const fetch = respond(200, {});
    const signal = new AbortController().signal;
    await request('/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
      signal,
      credentials: 'omit',
    });
    expect(fetch).toHaveBeenCalledWith('/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
      signal,
      credentials: 'omit',
    });
  });

  it('sends no headers, body or credentials unless given', async () => {
    const fetch = respond(200, {});
    await request('/api/x');
    expect(fetch).toHaveBeenCalledWith('/api/x', { method: 'GET', signal: undefined });
  });

  it('turns the shared error shape into an ApiRequestError, with Retry-After', async () => {
    respond(429, { error: { code: 'FORBIDDEN', message: 'slow', details: { n: 1 } } }, { 'retry-after': '30' });
    const error = await request('/api/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 429, code: 'FORBIDDEN', details: { n: 1 }, retryAfter: 30 });
  });

  it('answers an unknown failure body with INTERNAL_ERROR', async () => {
    respond(502, { nope: true });
    await expect(request('/api/x')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('reports an unreachable server as a network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/api/x')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'The server is not reachable',
    });
  });

  it('rethrows the caller abort as it is', async () => {
    const caller = new AbortController();
    caller.abort();
    const abort = new DOMException('aborted', 'AbortError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abort);
    await expect(request('/api/x', { signal: caller.signal })).rejects.toBe(abort);
  });

  it('gives up after the time limit as a network error', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const pending = request('/api/x', { timeoutMs: 1000 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'The server did not answer in time',
    });
  });
});
