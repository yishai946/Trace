import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BATTERY_REPORT_MS, reportBattery, resetBatteryReport } from '.';
import { useSession } from '../../state/session';

vi.mock('expo-battery', () => ({ getBatteryLevelAsync: vi.fn(async () => 0.5) }));

const missionId = '00000000-0000-4000-8000-000000000001';
const BATTERY = `https://api.test/api/missions/${missionId}/participation/battery`;
const participation = { status: 'active' } as never;

const okFetch = () => vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }));
const bodies = (fetch: ReturnType<typeof okFetch>) => fetch.mock.calls.map(([, init]) => JSON.parse(String(init.body)));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));
  resetBatteryReport();
  useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId, participation });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reportBattery', () => {
  it('sends the level in percent with the time it was measured', async () => {
    const fetch = okFetch();
    vi.stubGlobal('fetch', fetch);
    await reportBattery(async () => 0.756);

    expect(fetch.mock.calls[0]?.[0]).toBe(BATTERY);
    expect(fetch.mock.calls[0]?.[1].method).toBe('PUT');
    expect(bodies(fetch)).toEqual([{ level: 76, measuredAt: '2026-05-01T10:00:00.000Z' }]);
  });

  it('skips an unknown level (-1)', async () => {
    const fetch = okFetch();
    vi.stubGlobal('fetch', fetch);
    await reportBattery(async () => -1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips when the battery cannot be read', async () => {
    const fetch = okFetch();
    vi.stubGlobal('fetch', fetch);
    await reportBattery(async () => Promise.reject(new Error('no battery')));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not repeat the same level within the interval, but does when it changes or the interval passes', async () => {
    const fetch = okFetch();
    vi.stubGlobal('fetch', fetch);
    await reportBattery(async () => 0.5);
    await reportBattery(async () => 0.5);
    expect(fetch).toHaveBeenCalledTimes(1);

    await reportBattery(async () => 0.49);
    expect(fetch).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(BATTERY_REPORT_MS);
    await reportBattery(async () => 0.49);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('tries again on the next call when the server could not be reached, and never throws', async () => {
    const fetch = okFetch().mockRejectedValueOnce(new TypeError('Network request failed'));
    vi.stubGlobal('fetch', fetch);
    await expect(reportBattery(async () => 0.5)).resolves.toBeUndefined();
    await reportBattery(async () => 0.5);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['without a session', { token: null }],
    ['without a mission', { missionId: null }],
    ['after the activity ended', { participation: { status: 'ended' } as never }],
  ])('sends nothing %s', async (_name, state) => {
    const fetch = okFetch();
    vi.stubGlobal('fetch', fetch);
    useSession.setState(state);
    await reportBattery(async () => 0.5);
    expect(fetch).not.toHaveBeenCalled();
  });
});
