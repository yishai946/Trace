import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessagesInbox } from '.';
import { missionKeys } from '../../mission/queries';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';
import { makeCritical, makeMessage } from '../fixtures';

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const DELIVERED = '2026-10-03T16:56:00.000Z';

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useSession.setState({ token: 'tok', missionId: MISSION_ID });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null });
});

function serve(list: unknown[], receiptStatus = 200) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method !== 'PUT') return json(list);
    const id = String(url).split('/').at(-2);
    const found = list.find((m) => (m as { id: string }).id === id);
    return receiptStatus === 200
      ? json({ ...(found as object), deliveredAt: DELIVERED })
      : json({ error: { code: 'INTERNAL', message: 'x' } }, receiptStatus);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const puts = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([, init]) => init?.method === 'PUT');

describe('useMessagesInbox', () => {
  it('reports delivered once for each undelivered message and counts what needs the searcher', async () => {
    const list = [makeMessage(), makeCritical({ deliveredAt: DELIVERED }), makeMessage({ status: 'read' })];
    const fetch = serve(list);
    const { result } = renderHook(() => useMessagesInbox(), { wrapper });
    await waitFor(() => expect(result.current.unread).toBe(2));
    await waitFor(() => expect(puts(fetch)).toHaveLength(2));
    expect(puts(fetch).map(([, init]) => init.body)).toEqual([
      JSON.stringify({ receipt: 'delivered' }),
      JSON.stringify({ receipt: 'delivered' }),
    ]);
    // The answers fill deliveredAt in the cache: a later render does not report again.
    await waitFor(() =>
      expect(client.getQueryData<{ deliveredAt: string | null }[]>(missionKeys.messages(MISSION_ID))).toSatisfy(
        (cached: { deliveredAt: string | null }[]) => cached.every((m) => m.deliveredAt),
      ),
    );
    expect(puts(fetch)).toHaveLength(2);
  });

  it('tries again with the next list when a delivery report failed', async () => {
    const message = makeMessage();
    const fetch = serve([message], 500);
    const { result } = renderHook(() => useMessagesInbox(), { wrapper });
    await waitFor(() => expect(puts(fetch)).toHaveLength(1));
    await waitFor(() => expect(result.current.unread).toBe(1));
    await client.invalidateQueries({ queryKey: missionKeys.messages(MISSION_ID) });
    await waitFor(() => expect(puts(fetch)).toHaveLength(2));
  });
});
