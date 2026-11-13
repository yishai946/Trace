import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messageCritical, messageNormal, mission, sightingA } from './fixtures';
import { missionKeys, useSendMessage, useSightingMutations } from './missionQueries';

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
