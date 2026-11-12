import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newReportId, submitReport } from '.';
import { pending } from '../../outbox';
import { useSession } from '../../state/session';

const network = vi.hoisted(() => ({ state: { isConnected: true, isInternetReachable: true } }));
vi.mock('expo-network', () => ({
  getNetworkStateAsync: vi.fn(async () => network.state),
  addNetworkStateListener: vi.fn(() => ({ remove: vi.fn() })),
}));
vi.mock('expo-task-manager', () => ({ defineTask: vi.fn() }));
vi.mock('expo-location', () => ({ Accuracy: { High: 4 } }));

const missionId = '00000000-0000-4000-8000-000000000001';
const report = () => ({
  id: newReportId(),
  type: 'hazard' as const,
  text: 'מדרון חלק',
  position: { type: 'Point' as const, coordinates: [35.13, 31.78] as [number, number] },
  accuracy: 5,
  reportedAt: '2026-10-03T10:01:00.000Z',
});
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const saved = (r: ReturnType<typeof report>) => ({
  ...r,
  missionId,
  polygonId: null,
  status: 'new',
  reportedBy: { role: 'searcher', name: 'דנה', callsign: 4 },
  hasPhoto: false,
  createdAt: '2026-10-03T10:02:00.000Z',
});

beforeEach(() => {
  network.state = { isConnected: true, isInternetReachable: true };
  useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId });
});
afterEach(() => vi.unstubAllGlobals());

describe('submitReport', () => {
  it('without a connection keeps the report and its photo, the photo after the report, and does not call the server', async () => {
    network.state = { isConnected: false, isInternetReachable: false };
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const r = report();

    await expect(submitReport({ missionId, report: r, photo: { base64: 'AAEC' } })).resolves.toBe('pending');

    expect(fetch).not.toHaveBeenCalled();
    const items = await pending();
    expect(items.map((i) => i.kind)).toEqual(['report', 'report-photo']);
    expect(items[0]).toMatchObject({ id: r.id, missionId, payload: r });
    expect(items[1]?.payload).toEqual({ reportId: r.id, base64: 'AAEC' });
  });

  it('with a connection sends the report and is done', async () => {
    const r = report();
    const fetch = vi.fn(async () => json(201, saved(r)));
    vi.stubGlobal('fetch', fetch);

    await expect(submitReport({ missionId, report: r, photo: null })).resolves.toBe('sent');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await pending()).toEqual([]);
  });

  it('sends the photo after the report', async () => {
    const r = report();
    const fetch = vi.fn(async (_url: string, init: RequestInit) =>
      init.method === 'POST' ? json(201, saved(r)) : json(200, { ...saved(r), hasPhoto: true }),
    );
    vi.stubGlobal('fetch', fetch);

    await expect(submitReport({ missionId, report: r, photo: { base64: 'AAEC' } })).resolves.toBe('sent');
    expect(fetch.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'PUT']);
  });

  it('keeps the report as pending when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const r = report();

    await expect(submitReport({ missionId, report: r, photo: null })).resolves.toBe('pending');
    expect((await pending()).map((i) => i.id)).toEqual([r.id]);
  });

  it('says rejected, not sent, when the server refuses the report for good (the mission ended)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(409, { error: { code: 'MISSION_ENDED', message: 'ended' } })),
    );
    const r = report();

    await expect(submitReport({ missionId, report: r, photo: null })).resolves.toBe('rejected');
    expect(await pending()).toEqual([]);
  });
});
