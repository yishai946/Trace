import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OwnParticipation } from '@trace/schemas';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchFinish } from '.';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';

const searching: OwnParticipation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status: 'assigned',
  polygonId: '00000000-0000-4000-8000-0000000000a1',
  taskStatus: 'searching',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  useSession.setState({ token: 'tok', missionId: MISSION_ID, participation: searching, tracking: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null, participation: null, tracking: false });
});

describe('useSearchFinish (UC-F08)', () => {
  it('finishes the task, stays assigned and keeps safety tracking on', async () => {
    const fetch = vi.fn(async () => json({ ...searching, taskStatus: 'finished' }));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useSearchFinish(), { wrapper });
    act(() => result.current.finish());
    await waitFor(() => expect(useSession.getState().participation?.taskStatus).toBe('finished'));
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/participation/search/finish`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useSession.getState().participation).toMatchObject({ status: 'assigned', polygonId: searching.polygonId });
    expect(useSession.getState().tracking).toBe(true);
  });

  it('sends one request for a double tap', async () => {
    const fetch = vi.fn(async () => json({ ...searching, taskStatus: 'finished' }));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useSearchFinish(), { wrapper });
    act(() => {
      result.current.finish();
      result.current.finish();
    });
    await waitFor(() => expect(useSession.getState().participation?.taskStatus).toBe('finished'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the task as it was and says there is no connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network request failed');
      }),
    );
    const { result } = renderHook(() => useSearchFinish(), { wrapper });
    act(() => result.current.finish());
    await waitFor(() => expect(result.current.error).toBe('אין חיבור לשרת. המצב לא השתנה, נסו שוב.'));
    expect(useSession.getState().participation?.taskStatus).toBe('searching');
  });

  it.each([
    ['MISSION_NOT_ACTIVE', 'המסע מושהה. אפשר לסיים חיפוש רק כשהמסע פעיל.'],
    ['TASK_NOT_ACTIVE', 'אי אפשר לסיים חיפוש במצב הנוכחי. רעננו את המסך.'],
    ['MISSION_ENDED', 'המסע הסתיים.'],
  ])('explains %s', async (code, text) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code, message: 'no' } }, 409)),
    );
    const { result } = renderHook(() => useSearchFinish(), { wrapper });
    act(() => result.current.finish());
    await waitFor(() => expect(result.current.error).toBe(text));
  });
});
