import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messageCritical, messageNormal, mission, reportFinding, reportHazard, sightingA } from './fixtures';
import { missionKeys, useReportMutations, useSendMessage, useSightingMutations } from './missionQueries';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('useSightingMutations', () => {
  it('sends one request when a save is started twice before the first settles', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(Response.json(sightingA, { status: 201 })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSightingMutations(mission.id), { wrapper });
    const body = { position: sightingA.position, observedAt: sightingA.observedAt, source: 'witness' as const };
    const settled = vi.fn();
    act(() => {
      result.current.create(body, { onSettled: settled });
      result.current.create(body, { onSettled: settled });
    });
    await waitFor(() => expect(settled).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sends one request when a decision is started twice, and allows the next one after it settles', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(Response.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSightingMutations(mission.id), { wrapper });
    const settled = vi.fn();
    const args = { sightingId: sightingA.id, decision: 'accepted' as const };
    act(() => {
      result.current.decide(args, { onSettled: settled });
      result.current.decide(args, { onSettled: settled });
    });
    await waitFor(() => expect(settled).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
    act(() => result.current.decide(args, { onSettled: settled }));
    await waitFor(() => expect(settled).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('useSendMessage', () => {
  it('puts the sent message first, once, even after realtime added it', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(missionKeys.messages(mission.id), [messageNormal]);
    const fetchMock = vi.fn(() => Promise.resolve(Response.json(messageCritical, { status: 201 })));
    vi.stubGlobal('fetch', fetchMock);
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSendMessage(mission.id), { wrapper: clientWrapper });
    const body = { target: { kind: 'mission' as const }, urgency: 'critical' as const, body: messageCritical.body };

    await act(() => result.current.mutateAsync({ missionId: mission.id, body }));
    expect(queryClient.getQueryData(missionKeys.messages(mission.id))).toEqual([messageCritical, messageNormal]);

    // Realtime delivered it before the answer: the answer must not add it again.
    await act(() => result.current.mutateAsync({ missionId: mission.id, body }));
    expect(queryClient.getQueryData(missionKeys.messages(mission.id))).toEqual([messageCritical, messageNormal]);
  });
});

describe('useReportMutations', () => {
  const key = missionKeys.reports(mission.id);
  const setup = (answer: Response) => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(key, [reportFinding, reportHazard]);
    const fetchMock = vi.fn(() => Promise.resolve(answer));
    vi.stubGlobal('fetch', fetchMock);
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useReportMutations(mission.id), { wrapper: clientWrapper });
    return { queryClient, fetchMock, result };
  };

  it('replaces the cached report with the server answer when it is handled', async () => {
    const handled = { ...reportFinding, status: 'handled' as const };
    const { queryClient, fetchMock, result } = setup(Response.json(handled));
    await act(() => result.current.handle.mutateAsync(reportFinding.id));
    expect(queryClient.getQueryData(key)).toEqual([handled, reportHazard]);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/missions/${mission.id}/reports/${reportFinding.id}/handle`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('replaces the cached report with the edited one', async () => {
    const edited = { ...reportHazard, text: 'מדרון חלק מאוד' };
    const { queryClient, fetchMock, result } = setup(Response.json(edited));
    await act(() => result.current.update.mutateAsync({ reportId: reportHazard.id, text: edited.text }));
    expect(queryClient.getQueryData(key)).toEqual([reportFinding, edited]);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/missions/${mission.id}/reports/${reportHazard.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ text: edited.text }) }),
    );
  });

  it('drops a deleted report from the cache', async () => {
    const { queryClient, result } = setup(new Response(null, { status: 204 }));
    await act(() => result.current.remove.mutateAsync(reportFinding.id));
    expect(queryClient.getQueryData(key)).toEqual([reportHazard]);
  });

  it('reloads the missions when the mission ended meanwhile', async () => {
    const { queryClient, result } = setup(
      Response.json({ error: { code: 'MISSION_ENDED', message: 'ended' } }, { status: 409 }),
    );
    queryClient.setQueryData(missionKeys.all, [mission]);
    await act(() => result.current.handle.mutateAsync(reportFinding.id).catch(() => undefined));
    expect(queryClient.getQueryState(missionKeys.all)?.isInvalidated).toBe(true);
  });

  it('reloads the reports when the report is already gone', async () => {
    const { queryClient, result } = setup(Response.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 }));
    await act(() => result.current.remove.mutateAsync(reportFinding.id).catch(() => undefined));
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
