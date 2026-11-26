import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OwnParticipation } from '@trace/schemas';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStartSearch } from '.';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';

const assigned: OwnParticipation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status: 'assigned',
  polygonId: '00000000-0000-4000-8000-0000000000a1',
  taskStatus: 'ready',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  useSession.setState({ token: 'tok', missionId: MISSION_ID, participation: assigned, tracking: false });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null, participation: null, tracking: false });
});

describe('useStartSearch (UC-F06)', () => {
  it('posts the start and turns on tracking with the participation the server answers', async () => {
    const fetch = vi.fn(async () => json({ ...assigned, taskStatus: 'searching' }));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useStartSearch(), { wrapper });
    act(() => result.current.start());
    await waitFor(() => expect(useSession.getState().participation?.taskStatus).toBe('searching'));
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/participation/search/start`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useSession.getState().tracking).toBe(true);
  });

  it('sends one request for a double tap', async () => {
    const fetch = vi.fn(async () => json({ ...assigned, taskStatus: 'searching' }));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useStartSearch(), { wrapper });
    act(() => {
      result.current.start();
      result.current.start();
    });
    await waitFor(() => expect(useSession.getState().tracking).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the task at Ready and says there is no connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network request failed');
      }),
    );
    const { result } = renderHook(() => useStartSearch(), { wrapper });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.error).toBe('אין חיבור לשרת. החיפוש לא התחיל, נסו שוב.'));
    expect(useSession.getState()).toMatchObject({ tracking: false, participation: { taskStatus: 'ready' } });
  });

  it.each([
    ['MISSION_NOT_ACTIVE', 'המסע מושהה. אפשר להתחיל חיפוש רק כשהוא פעיל.'],
    ['MISSION_ENDED', 'המסע הסתיים.'],
    ['NOT_ASSIGNED', 'המנהל עדיין לא שיבץ אותך לפוליגון.'],
    ['TASK_NOT_READY', 'אי אפשר להתחיל חיפוש במצב הנוכחי. רעננו את המסך.'],
  ])('explains %s', async (code, text) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code, message: 'no' } }, 409)),
    );
    const { result } = renderHook(() => useStartSearch(), { wrapper });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.error).toBe(text));
  });
});
