import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExpoPushSender } from '.';

const URL = 'https://exp.host/--/api/v2/push/send';
const message = { title: 'SOS', body: 'מחפש בסכנה' };

const ok = { status: 'ok', id: 'r' } as const;
const dead = { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } as const;
const rateLimited = { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } } as const;

/** Stubs fetch to answer each request with `tickets(sentMessages)`. */
function stubFetch(tickets: (messages: Array<{ to: string }>) => unknown[], status = 200) {
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    // The SDK gzips large requests.
    const raw = typeof init.body === 'string' ? init.body : gunzipSync(init.body as Buffer).toString();
    const sent = JSON.parse(raw) as Array<{ to: string }>;
    return new Response(JSON.stringify({ data: tickets(sent) }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('createExpoPushSender', () => {
  it('posts one message per token and sends no Authorization header without an access token', async () => {
    const fetch = stubFetch((sent) => sent.map(() => ok));
    const data = { missionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', screen: 'sos' as const };
    await createExpoPushSender({}).send(['ExponentPushToken[a]', 'ExponentPushToken[b]'], { ...message, data });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(URL);
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBeNull();
    const body = JSON.parse(init?.body as string) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ to: 'ExponentPushToken[a]', title: 'SOS', body: 'מחפש בסכנה', data });
    expect(body[1]).toMatchObject({ to: 'ExponentPushToken[b]' });
  });

  it('sends the access token as a bearer token when one is set', async () => {
    const fetch = stubFetch((sent) => sent.map(() => ok));
    await createExpoPushSender({ accessToken: 'secret' }).send(['ExponentPushToken[a]'], message);
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer secret');
  });

  it('returns tokens Expo reports as DeviceNotRegistered as invalid', async () => {
    stubFetch(() => [ok, dead]);
    const result = await createExpoPushSender({}).send(['ExponentPushToken[a]', 'ExponentPushToken[b]'], message);
    expect(result).toEqual({ invalidTokens: ['ExponentPushToken[b]'], failedTokens: [] });
  });

  it('keeps tokens whose ticket failed for another reason', async () => {
    stubFetch(() => [rateLimited]);
    const result = await createExpoPushSender({}).send(['ExponentPushToken[a]'], message);
    expect(result).toEqual({ invalidTokens: [], failedTokens: ['ExponentPushToken[a]'] });
  });

  it('splits 150 tokens into two requests and maps tickets back to the right token', async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[t${i}]`);
    const fetch = stubFetch((sent) => sent.map((m) => (m.to === 'ExponentPushToken[t120]' ? dead : ok)));
    const result = await createExpoPushSender({}).send(tokens, message);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ invalidTokens: ['ExponentPushToken[t120]'], failedTokens: [] });
  });

  it('does not throw when a request fails, and reports its tokens as failed', async () => {
    stubFetch(() => [], 500);
    const result = await createExpoPushSender({}).send(['ExponentPushToken[a]', 'ExponentPushToken[b]'], message);
    expect(result.invalidTokens).toEqual([]);
    expect(result.failedTokens).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
  });
});
