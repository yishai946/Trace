import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageReceipt } from '.';
import { missionKeys } from '../../mission/queries';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';
import { makeMessage } from '../fixtures';

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

describe('useMessageReceipt', () => {
  it('puts the receipt and replaces the message in the cached list with the answer', async () => {
    const message = makeMessage();
    client.setQueryData(missionKeys.messages(MISSION_ID), [message]);
    const read = { ...message, status: 'read' as const, readAt: '2026-10-03T17:00:00.000Z' };
    const fetch = vi.fn(async () => json(read));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useMessageReceipt(), { wrapper });
    result.current.mutate({ messageId: message.id, receipt: 'read' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/participation/messages/${message.id}/receipt`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ receipt: 'read' }) }),
    );
    expect(client.getQueryData(missionKeys.messages(MISSION_ID))).toEqual([read]);
  });

  it('keeps the cached message when the server refuses', async () => {
    const message = makeMessage();
    client.setQueryData(missionKeys.messages(MISSION_ID), [message]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'MESSAGE_NOT_CRITICAL', message: 'no' } }, 409)),
    );
    const { result } = renderHook(() => useMessageReceipt(), { wrapper });
    result.current.mutate({ messageId: message.id, receipt: 'acknowledged' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(missionKeys.messages(MISSION_ID))).toEqual([message]);
  });
});
