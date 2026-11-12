import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordFixes, trackPointSender } from '.';
import { pending, type OutboxItem } from '../../outbox';
import { useSession } from '../../state/session';

const missionId = '00000000-0000-4000-8000-000000000001';
const participation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status: 'assigned' as const,
  polygonId: '00000000-0000-4000-8000-0000000000a1',
  taskStatus: 'searching' as const,
};
const fix = (minute: number) => ({
  coords: { latitude: 31.78, longitude: 35.13, accuracy: 5 },
  timestamp: Date.UTC(2026, 9, 3, 10, minute),
});
const point = { position: [35.13, 31.78], recordedAt: '2026-10-03T10:01:00.000Z', accuracy: 5, context: 'search' };
const item = (payload: unknown): OutboxItem => ({ id: 'i', kind: 'track-point', missionId, payload, createdAt: 0 });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const failure = (status: number, code: string) => json(status, { error: { code, message: 'x' } });

beforeEach(() => useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId, participation }));
afterEach(() => vi.unstubAllGlobals());

describe('recordFixes', () => {
  it('stores one item per fix, in order, with the context of the task at record time', async () => {
    await recordFixes([fix(1), fix(2)]);
    // The searcher pauses before the next send: the stored points keep `search`.
    useSession.setState({ participation: { ...participation, taskStatus: 'paused' } });
    await recordFixes([fix(3)]);

    const items = await pending();
    expect(items.map((i) => i.missionId)).toEqual([missionId, missionId, missionId]);
    expect(items.map((i) => i.payload)).toEqual([
      point,
      { ...point, recordedAt: '2026-10-03T10:02:00.000Z' },
      { ...point, recordedAt: '2026-10-03T10:03:00.000Z', context: 'safety' },
    ]);
  });

  it('never stores the token', async () => {
    await recordFixes([fix(1)]);
    expect(JSON.stringify(await pending())).not.toContain('t1');
  });

  it('stores nothing without a mission or a session, after the activity ended, or for an empty batch', async () => {
    await recordFixes([]);
    useSession.setState({ participation: { ...participation, status: 'ended' } });
    await recordFixes([fix(1)]);
    useSession.setState({ missionId: null, participation });
    await recordFixes([fix(1)]);
    useSession.setState({ missionId, participation: null });
    await recordFixes([fix(1)]);
    useSession.setState({ participation, token: null });
    await recordFixes([fix(1)]);

    expect(await pending()).toEqual([]);
  });
});

describe('trackPointSender', () => {
  const onEnded = vi.fn();
  const sender = trackPointSender(onEnded);
  beforeEach(() => onEnded.mockClear());

  it('sends a batch of at most 500 points to the mission with the session token', async () => {
    const fetch = vi.fn(async () => json(200, { stored: 1, duplicates: 0 }));
    vi.stubGlobal('fetch', fetch);

    expect(sender.batchSize).toBe(500);
    await expect(sender.send(missionId, [item(point)])).resolves.toBe('sent');
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${missionId}/track-points`,
      expect.objectContaining({
        method: 'POST',
        headers: { authorization: 'Bearer t1', 'content-type': 'application/json' },
        body: JSON.stringify({ points: [point] }),
      }),
    );
  });

  it('counts a batch the server already had as sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, { stored: 0, duplicates: 1 })),
    );
    await expect(sender.send(missionId, [item(point)])).resolves.toBe('sent');
  });

  it.each([
    [409, 'PARTICIPATION_ENDED'],
    [404, 'NOT_FOUND'],
    [403, 'FORBIDDEN'],
  ])('drops the mission on %i', async (status, code) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failure(status, code)),
    );
    await expect(sender.send(missionId, [item(point)])).resolves.toBe('drop-mission');
    expect(onEnded).toHaveBeenCalledTimes(code === 'PARTICIPATION_ENDED' ? 1 : 0);
    if (code === 'PARTICIPATION_ENDED') expect(onEnded).toHaveBeenCalledWith(missionId);
  });

  it('drops only the batch on 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failure(400, 'VALIDATION_ERROR')),
    );
    await expect(sender.send(missionId, [item(point)])).resolves.toBe('drop-batch');
  });

  it('drops the batch, without a request, when a stored point is not valid', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(sender.send(missionId, [item(point), item({ position: 'x' })])).resolves.toBe('drop-batch');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['the network is down', () => Promise.reject(new TypeError('Network request failed'))],
    ['the server fails', async () => failure(500, 'INTERNAL_ERROR')],
    ['the server limits the rate', async () => failure(429, 'RATE_LIMITED')],
    ['the session expired', async () => failure(401, 'UNAUTHENTICATED')],
    ['the answer is not understood', async () => json(200, { nope: true })],
  ])('keeps the batch when %s', async (_name, respond) => {
    vi.stubGlobal('fetch', vi.fn(respond));
    await expect(sender.send(missionId, [item(point)])).rejects.toBeDefined();
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('keeps the batch while there is no token, without a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    useSession.setState({ token: null });
    await expect(sender.send(missionId, [item(point)])).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
