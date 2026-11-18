import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMissionSos } from '.';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';
import { makeSos } from '../fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => useSession.setState({ token: 'tok', missionId: MISSION_ID }));
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null });
});

describe('useMissionSos', () => {
  it('reads the mission SOS list with the token', async () => {
    const sos = makeSos();
    const fetch = vi.fn(
      async () => new Response(JSON.stringify([sos]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useMissionSos(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([sos]));
    expect(fetch).toHaveBeenCalledWith(`https://api.test/api/missions/${MISSION_ID}/sos`, expect.anything());
  });

  it('waits for a mission', () => {
    useSession.setState({ missionId: null });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderHook(() => useMissionSos(), { wrapper });
    expect(fetch).not.toHaveBeenCalled();
  });
});
