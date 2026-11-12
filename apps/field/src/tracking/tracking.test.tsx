import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiveFixes, useLocationTracking, useOutboxSync, type LocationTracker } from '.';
import { pending } from '../outbox';
import { useSession } from '../state/session';

const platform = vi.hoisted(() => ({ OS: 'ios' }));
const appState = vi.hoisted(() => ({ listeners: new Set<(state: string) => void>(), removed: vi.fn() }));
const network = vi.hoisted(() => ({ listeners: new Set<(state: object) => void>(), removed: vi.fn() }));
vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Platform: {
    get OS() {
      return platform.OS;
    },
    select: (o: Record<string, unknown>) => o.ios ?? o.default,
  },
  AppState: {
    addEventListener: (_type: string, listener: (state: string) => void) => {
      appState.listeners.add(listener);
      return {
        remove: () => {
          appState.listeners.delete(listener);
          appState.removed();
        },
      };
    },
  },
}));
vi.mock('expo-network', () => ({
  addNetworkStateListener: (listener: (state: object) => void) => {
    network.listeners.add(listener);
    return {
      remove: () => {
        network.listeners.delete(listener);
        network.removed();
      },
    };
  },
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
  const missionId = '00000000-0000-4000-8000-000000000001';
  const otherMissionId = '00000000-0000-4000-8000-000000000009';
  const locations = (...minutes: number[]) =>
    minutes.map((minute) => ({
      coords: { latitude: 31.78, longitude: 35.13, accuracy: 5 },
      timestamp: Date.UTC(2026, 9, 3, 10, minute),
    }));
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const ended = () => json(409, { error: { code: 'PARTICIPATION_ENDED', message: 'x' } });
  const bodyOf = (call: unknown[] | undefined) =>
    (JSON.parse((call?.[1] as RequestInit).body as string) as { points: { recordedAt: string }[] }).points.map(
      (p) => p.recordedAt,
    );

  beforeEach(() => {
    location.stop.mockClear();
    network.listeners.clear();
    appState.listeners.clear();
    platform.OS = 'ios';
    useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId, participation, tracking: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uploads a batch, empties the queue, and ignores an empty delivery', async () => {
    const fetch = vi.fn(async () => json(200, { stored: 1, duplicates: 0 }));
    vi.stubGlobal('fetch', fetch);
    await receiveFixes({ data: { locations: locations(1) }, error: null });
    await receiveFixes({ data: undefined, error: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await pending()).toEqual([]);
  });

  it('keeps the batch on the device when the server is not reachable, without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await expect(receiveFixes({ data: { locations: locations(1, 2) }, error: null })).resolves.toBeUndefined();
    expect(await pending()).toHaveLength(2);
  });

  it('queues three offline deliveries, then sends all points in order in one batch when the network is back', async () => {
    let online = false;
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => {
      if (!online) throw new TypeError('offline');
      return json(200, { stored: 3, duplicates: 0 });
    });
    vi.stubGlobal('fetch', fetch);
    const { unmount } = renderHook(() => useOutboxSync());
    fetch.mockClear();

    await receiveFixes({ data: { locations: locations(1) }, error: null });
    await receiveFixes({ data: { locations: locations(2) }, error: null });
    await receiveFixes({ data: { locations: locations(3) }, error: null });
    expect(await pending()).toHaveLength(3);

    online = true;
    fetch.mockClear();
    await act(async () => {
      for (const listener of network.listeners) listener({ isConnected: true, isInternetReachable: true });
    });
    await vi.waitFor(async () => expect(await pending()).toEqual([]));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetch.mock.calls[0])).toEqual([
      '2026-10-03T10:01:00.000Z',
      '2026-10-03T10:02:00.000Z',
      '2026-10-03T10:03:00.000Z',
    ]);
    unmount();
  });

  it('takes a location error as GPS lost and tells the server, storing nothing', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await receiveFixes({ data: undefined, error: new Error('denied') });

    expect(useSession.getState().gpsAvailable).toBe(false);
    expect(fetch.mock.calls[0]?.[0]).toMatch(/\/participation\/gps$/);
    expect(await pending()).toEqual([]);
  });

  it('stops tracking when the server says the activity ended, and drops that mission points', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ended()),
    );
    await receiveFixes({ data: { locations: locations(1) }, error: null });

    expect(useSession.getState()).toMatchObject({ tracking: false, participation: { status: 'ended' } });
    expect(location.stop).toHaveBeenCalled();
    expect(await pending()).toEqual([]);
  });

  it('drops the points of another ended mission without stopping the current tracking', async () => {
    useSession.setState({ missionId: otherMissionId });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await receiveFixes({ data: { locations: locations(1) }, error: null });
    useSession.setState({ missionId });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ended()),
    );
    await receiveFixes({ data: { locations: locations(2) }, error: null });

    expect(await pending()).toEqual([]);
    expect(useSession.getState()).toMatchObject({ tracking: false });
  });
});

describe('useOutboxSync', () => {
  const session = {
    token: 't1',
    missionId: '00000000-0000-4000-8000-000000000001',
    participation: {
      id: '00000000-0000-4000-8000-000000000002',
      callsign: 4,
      status: 'assigned' as const,
      polygonId: '00000000-0000-4000-8000-0000000000a1',
      taskStatus: 'searching' as const,
    },
  };
  const fix = { coords: { latitude: 31.78, longitude: 35.13, accuracy: 5 }, timestamp: Date.UTC(2026, 9, 3) };
  const ok = () =>
    new Response(JSON.stringify({ stored: 1, duplicates: 0 }), { headers: { 'content-type': 'application/json' } });

  /** One point waiting in the outbox, left there because the server was down. */
  async function leaveOnePoint() {
    useSession.setState({ ...useSession.getInitialState(), ...session });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await receiveFixes({ data: { locations: [fix] }, error: null });
    expect(await pending()).toHaveLength(1);
  }

  beforeEach(() => {
    network.listeners.clear();
    appState.listeners.clear();
    network.removed.mockClear();
    appState.removed.mockClear();
    platform.OS = 'ios';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends what waits as soon as there is a token', async () => {
    await leaveOnePoint();
    const fetch = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetch);
    renderHook(() => useOutboxSync());
    await vi.waitFor(async () => expect(await pending()).toEqual([]));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends when the token becomes available', async () => {
    await leaveOnePoint();
    useSession.setState({ token: null });
    renderHook(() => useOutboxSync());
    const fetch = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetch);
    useSession.setState({ token: 't1' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('sends again when the app comes to the foreground or the network is back, not when it drops, and stops listening on unmount', async () => {
    await leaveOnePoint();
    const fetch = vi.fn(async () => Promise.reject(new TypeError('offline')));
    vi.stubGlobal('fetch', fetch);
    const { unmount } = renderHook(() => useOutboxSync());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      for (const listener of network.listeners) listener({ isConnected: false, isInternetReachable: false });
      for (const listener of network.listeners) listener({ isConnected: true, isInternetReachable: false });
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      for (const listener of appState.listeners) listener('background');
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      for (const listener of appState.listeners) listener('active');
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    unmount();
    expect(network.removed).toHaveBeenCalledTimes(1);
    expect(appState.removed).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a token, or on the web', async () => {
    await leaveOnePoint();
    const fetch = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetch);
    useSession.setState({ token: null });
    renderHook(() => useOutboxSync());
    platform.OS = 'web';
    useSession.setState({ token: 't1' });
    renderHook(() => useOutboxSync());

    expect(fetch).not.toHaveBeenCalled();
    expect(network.listeners.size).toBe(0);
    expect(appState.listeners.size).toBe(0);
  });
});
