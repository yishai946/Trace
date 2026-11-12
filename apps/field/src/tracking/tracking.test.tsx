import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiveFixes, useLocationTracking, type LocationTracker } from '.';
import { useSession } from '../state/session';

vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
}));
vi.mock('expo-task-manager', () => ({ defineTask: vi.fn() }));
const location = vi.hoisted(() => ({ stop: vi.fn(), started: vi.fn(async () => true) }));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasServicesEnabledAsync: vi.fn(async () => true),
  getForegroundPermissionsAsync: vi.fn(async () => ({ granted: true })),
  startLocationUpdatesAsync: vi.fn(),
  stopLocationUpdatesAsync: location.stop,
  hasStartedLocationUpdatesAsync: location.started,
}));

const fakeTracker = () => ({ start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) });

describe('useLocationTracking', () => {
  beforeEach(() => useSession.setState(useSession.getInitialState()));

  it('starts the tracker while the session tracks, and stops it after', () => {
    const tracker = fakeTracker();
    const { rerender } = renderHook(() => useLocationTracking(tracker satisfies LocationTracker));
    expect(tracker.stop).toHaveBeenCalledTimes(1);
    expect(tracker.start).not.toHaveBeenCalled();

    useSession.setState({ tracking: true });
    rerender();
    expect(tracker.start).toHaveBeenCalledTimes(1);

    useSession.setState({ tracking: false });
    rerender();
    expect(tracker.stop).toHaveBeenCalledTimes(2);
  });
});

describe('receiveFixes, the background task', () => {
  const participation = {
    id: '00000000-0000-4000-8000-000000000002',
    callsign: 4,
    status: 'assigned' as const,
    polygonId: '00000000-0000-4000-8000-0000000000a1',
    taskStatus: 'searching' as const,
  };
  const locations = [{ coords: { latitude: 31.78, longitude: 35.13, accuracy: 5 }, timestamp: Date.UTC(2026, 9, 3) }];
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  beforeEach(() => {
    location.stop.mockClear();
    useSession.setState({
      ...useSession.getInitialState(),
      token: 't1',
      missionId: '00000000-0000-4000-8000-000000000001',
      participation,
      tracking: true,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uploads a batch and ignores an empty delivery', async () => {
    const fetch = vi.fn(async () => json(200, { stored: 1, duplicates: 0 }));
    vi.stubGlobal('fetch', fetch);
    await receiveFixes({ data: { locations }, error: null });
    await receiveFixes({ data: undefined, error: null });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('takes a location error as GPS lost and tells the server', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await receiveFixes({ data: undefined, error: new Error('denied') });

    expect(useSession.getState().gpsAvailable).toBe(false);
    expect(fetch.mock.calls[0]?.[0]).toMatch(/\/participation\/gps$/);
  });

  it('stops tracking when the server says the activity ended', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(409, { error: { code: 'PARTICIPATION_ENDED', message: 'x' } })),
    );
    await receiveFixes({ data: { locations }, error: null });

    expect(useSession.getState()).toMatchObject({ tracking: false, participation: { status: 'ended' } });
    expect(location.stop).toHaveBeenCalled();
  });
});
