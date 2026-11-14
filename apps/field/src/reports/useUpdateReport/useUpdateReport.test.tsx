import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateReport } from '.';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';
import { makeReport, MISSION_ID } from '../fixtures';

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
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null });
});

describe('useUpdateReport', () => {
  it('patches the report with the token and puts the saved report in the cached list', async () => {
    const report = makeReport({ text: 'ישן' });
    const other = makeReport({ text: 'אחר' });
    client.setQueryData(missionKeys.reports(MISSION_ID), [report, other]);
    const saved = { ...report, text: 'חדש', type: 'general' as const };
    const fetch = vi.fn(async () => json(saved));
    vi.stubGlobal('fetch', fetch);

    const { result } = renderHook(() => useUpdateReport(), { wrapper });
    result.current.mutate({ reportId: report.id, body: { text: 'חדש', type: 'general' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/reports/${report.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ text: 'חדש', type: 'general' }),
        headers: expect.objectContaining({ authorization: 'Bearer tok' }),
      }),
    );
    expect(client.getQueryData(missionKeys.reports(MISSION_ID))).toEqual([saved, other]);
  });

  it('fails and leaves the cached list as it was when the server refuses', async () => {
    const report = makeReport();
    client.setQueryData(missionKeys.reports(MISSION_ID), [report]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'FORBIDDEN', message: 'x' } }, 403)),
    );
    const { result } = renderHook(() => useUpdateReport(), { wrapper });
    result.current.mutate({ reportId: report.id, body: { text: 'חדש' } });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(missionKeys.reports(MISSION_ID))).toEqual([report]);
  });
});
