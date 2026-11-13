import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMissionReports } from '.';
import { useSession } from '../../state/session';
import { makeReport, MISSION_ID } from '../fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  useSession.setState({ token: 'tok', missionId: MISSION_ID });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null });
});

describe('useMissionReports', () => {
  it('asks for the mission’s reports with the session token and returns them', async () => {
    const reports = [makeReport(), makeReport({ text: 'שביל חסום' })];
    const fetch = vi.fn(async () => json(reports));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useMissionReports(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(reports);
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/reports`,
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok' }) }),
    );
  });

  it('surfaces an error when the server fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500)),
    );
    const { result } = renderHook(() => useMissionReports(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not ask without a token or a mission', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    useSession.setState({ token: null });
    const { result } = renderHook(() => useMissionReports(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetch).not.toHaveBeenCalled();
  });
});
