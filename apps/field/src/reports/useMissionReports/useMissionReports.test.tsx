import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMissionReports } from '.';
import { loadStep, saveStep } from '../../offline/store';
import { ReportList } from '@trace/schemas';
import { useSession } from '../../state/session';
import { assigned, makeReport, MISSION_ID } from '../fixtures';

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
    await waitFor(() => expect(result.current.data).toEqual(reports));
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

  it('saves the list on the phone, so it can be shown without a connection (UC-F11)', async () => {
    const reports = [makeReport()];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(reports)),
    );
    const { result } = renderHook(() => useMissionReports(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(reports));
    await waitFor(async () => expect(await loadStep(MISSION_ID, 'reports', ReportList)).toEqual(reports));
    expect(result.current.notUpToDate).toBe(false);
  });

  it('shows the saved list marked not up to date when the server cannot be reached', async () => {
    const reports = [makeReport({ text: 'נשמר קודם' })];
    await saveStep(MISSION_ID, 'reports', { json: reports });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    const { result } = renderHook(() => useMissionReports(), { wrapper });
    await waitFor(() => expect(result.current.notUpToDate).toBe(true));
    expect(result.current.data).toEqual(reports);
    expect(result.current.isError).toBe(false);
  });

  it('shows an error when nothing was saved and the server cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500)),
    );
    const { result } = renderHook(() => useMissionReports(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('marks the list in memory not up to date when a later refresh fails', async () => {
    const reports = [makeReport()];
    let ok = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (ok ? json(reports) : json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500))),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const shared = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMissionReports(), { wrapper: shared });
    await waitFor(() => expect(result.current.data).toEqual(reports));
    expect(result.current.notUpToDate).toBe(false);
    ok = false;
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.notUpToDate).toBe(true));
    expect(result.current.data).toEqual(reports);
  });

  it('does not save the list again once the activity has ended', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([makeReport()])),
    );
    useSession.setState({ participation: { ...assigned, status: 'ended' } });
    const { result } = renderHook(() => useMissionReports(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await loadStep(MISSION_ID, 'reports', ReportList)).toBeNull();
  });
});
