import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GPS_CHECK_MS, useGpsStatus } from '.';
import { useSession } from '../../state/session';

vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
}));
vi.mock('expo-location', () => ({ hasServicesEnabledAsync: vi.fn(async () => true) }));

const missionId = '00000000-0000-4000-8000-000000000001';
const GPS = `https://api.test/api/missions/${missionId}/participation/gps`;

beforeEach(() => {
  vi.useFakeTimers();
  useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId, tracking: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useGpsStatus', () => {
  it('reports a lost GPS once, then its return, while tracking', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    let enabled = false;
    renderHook(() => useGpsStatus(async () => enabled));
    await act(async () => {});
    expect(useSession.getState().gpsAvailable).toBe(false);

    await act(async () => vi.advanceTimersByTime(GPS_CHECK_MS));
    enabled = true;
    await act(async () => vi.advanceTimersByTime(GPS_CHECK_MS));

    expect(useSession.getState().gpsAvailable).toBe(true);
    expect(fetch.mock.calls.map(([url, init]) => [url, init.body])).toEqual([
      [GPS, JSON.stringify({ available: false })],
      [GPS, JSON.stringify({ available: true })],
    ]);
  });

  it('does nothing while not tracking', async () => {
    const check = vi.fn(async () => false);
    useSession.setState({ tracking: false });
    renderHook(() => useGpsStatus(check));
    await act(async () => vi.advanceTimersByTime(GPS_CHECK_MS));
    expect(check).not.toHaveBeenCalled();
    expect(useSession.getState().gpsAvailable).toBeNull();
  });
});
