import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloseSos } from '.';
import { missionKeys } from '../../mission/queries';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';
import { makeSos, SOS_ID } from '../fixtures';

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useSession.setState({ token: 'tok', missionId: MISSION_ID });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null });
});

describe('useCloseSos', () => {
  it('posts the close and puts the closed SOS in the cached list', async () => {
    client.setQueryData(missionKeys.sos(MISSION_ID), [makeSos()]);
    const closed = makeSos({
      status: 'closed',
      closedAt: '2026-10-03T17:10:00.000Z',
      closedBy: { role: 'searcher', name: 'דנה כהן' },
    });
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(closed), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useCloseSos(), { wrapper });
    result.current.mutate(SOS_ID);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/sos/${SOS_ID}/close`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(client.getQueryData(missionKeys.sos(MISSION_ID))).toEqual([closed]);
  });
});
