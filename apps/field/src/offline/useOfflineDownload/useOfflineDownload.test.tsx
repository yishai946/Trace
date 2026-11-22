import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../../state/session';
import { MISSION_ID, mission, polygon } from '../downloadPackage/fixtures';
import { useOfflineState } from '../state';
import { savedSteps } from '../store';
import { useOfflinePackage } from '../useOfflinePackage';
import { RETRY_AFTER_MS, useOfflineDownload } from './index';

const network = vi.hoisted(() => ({ listeners: new Set<(state: object) => void>() }));
vi.mock('expo-network', () => ({
  addNetworkStateListener: (listener: (state: object) => void) => {
    network.listeners.add(listener);
    return { remove: () => network.listeners.delete(listener) };
  },
}));

const OTHER = '00000000-0000-4000-8000-000000000009';
const participation = { id: 'p', callsign: 7, status: 'available', polygonId: null, taskStatus: null } as const;
let online = true;

function serve() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (!online) throw new TypeError('offline');
    const url = String(input);
    if (url.endsWith('/photo?v=1'))
      return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } });
    if (url.endsWith('/polygons')) return Response.json([polygon]);
    const id = url.split('/').pop();
    return Response.json({ ...mission, id });
  });
}

function join(missionId = MISSION_ID) {
  act(() => {
    useSession.setState({ token: 'tok' });
    useSession.getState().enterMission(missionId, participation);
  });
}

const mount = () =>
  renderHook(() => {
    useOfflineDownload();
    return useOfflinePackage();
  });

describe('useOfflineDownload', () => {
  beforeEach(() => {
    online = true;
    useOfflineState.setState({ missionId: null, saved: [], loaded: false, running: false, failed: false });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    useSession.setState({ token: null, missionId: null, participation: null });
  });

  it('downloads right after joining, shows the progress and then the package as ready', async () => {
    serve();
    const hook = mount();
    expect(hook.result.current.status).toBe('checking');
    join();
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(hook.result.current.progress.percent).toBe(100);
    expect(hook.result.current.startSearch.ready).toBe(true);
    expect(await savedSteps(MISSION_ID)).toHaveLength(3);
  });

  it('keeps the searcher in the mission with Start Search blocked when the connection drops, and completes on return', async () => {
    online = false;
    serve();
    const hook = mount();
    join();
    await waitFor(() => expect(hook.result.current.status).toBe('interrupted'));
    expect(useSession.getState().missionId).toBe(MISSION_ID);
    expect(hook.result.current.startSearch.ready).toBe(false);

    online = true;
    act(() => network.listeners.forEach((listener) => listener({ isConnected: true, isInternetReachable: true })));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(hook.result.current.startSearch.ready).toBe(true);
  });

  it('does not start again for a connection that is still unreachable', async () => {
    online = false;
    const fetch = serve();
    const hook = mount();
    join();
    await waitFor(() => expect(hook.result.current.status).toBe('interrupted'));
    const calls = fetch.mock.calls.length;
    act(() => network.listeners.forEach((listener) => listener({ isConnected: true, isInternetReachable: false })));
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it('resumes by itself after a while, without a connection event', async () => {
    const retries: (() => void)[] = [];
    const real = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: () => void, delay?: number) => {
      if (delay === RETRY_AFTER_MS) {
        retries.push(handler);
        return 0;
      }
      return real(handler, delay);
    }) as typeof setTimeout);
    online = false;
    serve();
    const hook = mount();
    join();
    await waitFor(() => expect(hook.result.current.status).toBe('interrupted'));
    online = true;
    act(() => retries.forEach((retry) => retry()));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  });

  it('resumes on "try again"', async () => {
    online = false;
    serve();
    const hook = mount();
    join();
    await waitFor(() => expect(hook.result.current.status).toBe('interrupted'));
    online = true;
    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  });

  it('does not download again when the app starts with the package already saved', async () => {
    serve();
    const first = mount();
    join();
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    vi.restoreAllMocks();
    act(() => useOfflineState.setState({ missionId: null, saved: [], loaded: false }));
    const fetch = serve();
    const second = mount();
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops the previous mission package and downloads the new one on a mission switch', async () => {
    serve();
    const hook = mount();
    join();
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    join(OTHER);
    await waitFor(() => expect(useOfflineState.getState().missionId).toBe(OTHER));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(await savedSteps(MISSION_ID)).toEqual([]);
    expect(await savedSteps(OTHER)).toHaveLength(3);
  });

  it('downloads nothing for a participation that ended', async () => {
    const fetch = serve();
    mount();
    act(() => {
      useSession.setState({ token: 'tok' });
      useSession.getState().enterMission(MISSION_ID, { ...participation, status: 'ended' });
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).not.toHaveBeenCalled();
  });
});
