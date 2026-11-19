import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActivateSos } from '.';
import { missionKeys } from '../../mission/queries';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';
import { makeSos } from '../fixtures';

const network = vi.hoisted(() => ({ state: { isConnected: true, isInternetReachable: true } }));
vi.mock('expo-network', () => ({ getNetworkStateAsync: vi.fn(async () => network.state) }));

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useSession.setState({ token: 'tok', missionId: MISSION_ID });
});
afterEach(() => {
  network.state = { isConnected: true, isInternetReachable: true };
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null });
});

describe('useActivateSos', () => {
  it('posts the message and the location with the token and caches the SOS', async () => {
    const sos = makeSos({ message: 'נפלתי' });
    const fetch = vi.fn(async () => json(sos, 201));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useActivateSos(), { wrapper });
    const body = { message: 'נפלתי', location: null };
    result.current.mutate(body);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/sos`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
        headers: expect.objectContaining({ authorization: 'Bearer tok' }),
      }),
    );
    expect(client.getQueryData(missionKeys.sos(MISSION_ID))).toEqual([sos]);
  });

  it('takes the 200 answer for an SOS that is already active without adding it twice', async () => {
    const sos = makeSos();
    client.setQueryData(missionKeys.sos(MISSION_ID), [sos]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(sos, 200)),
    );
    const { result } = renderHook(() => useActivateSos(), { wrapper });
    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(missionKeys.sos(MISSION_ID))).toEqual([sos]);
  });

  it('fails and leaves the list alone when the server is not reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500)),
    );
    const { result } = renderHook(() => useActivateSos(), { wrapper });
    result.current.mutate({ message: 'עזרה' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(missionKeys.sos(MISSION_ID))).toBeUndefined();
  });

  it.each([
    ['no network', { isConnected: false, isInternetReachable: false }],
    ['a network without internet', { isConnected: true, isInternetReachable: false }],
  ])('fails at once with a network error and sends nothing on %s', async (_, state) => {
    network.state = state;
    const fetch = vi.fn(async () => json(makeSos(), 201));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useActivateSos(), { wrapper });
    result.current.mutate({ message: 'עזרה' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
