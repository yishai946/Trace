import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OwnParticipation } from '@trace/schemas';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFinishActivity } from '.';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';

const syncOutbox = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../../tracking', () => ({ syncOutbox }));

const searching: OwnParticipation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status: 'assigned',
  polygonId: '00000000-0000-4000-8000-0000000000a1',
  taskStatus: 'searching',
};
const ended: OwnParticipation = { ...searching, status: 'ended', polygonId: null, taskStatus: null };
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
  syncOutbox.mockClear();
  useSession.setState({ token: null, missionId: null, participation: null, tracking: false, assignmentNotice: null });
});

describe('useFinishActivity (UC-F15)', () => {
  it('sends what the phone collected, ends the activity, stops tracking and does not say the commander removed them', async () => {
    const fetch = vi.fn(async () => json(ended));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useFinishActivity(), { wrapper });
    act(() => result.current.finish());
    await waitFor(() => expect(useSession.getState().participation?.status).toBe('ended'));
    expect(syncOutbox).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/participation/finish-activity`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useSession.getState().tracking).toBe(false);
    expect(useSession.getState().assignmentNotice).toBeNull();
  });

  it('ends the mission it was confirmed in, even if the session moves to another during the flush', async () => {
    const OTHER = '00000000-0000-4000-8000-0000000000ff';
    syncOutbox.mockImplementationOnce(async () => {
      useSession.setState({ missionId: OTHER });
    });
    const fetch = vi.fn(async () => json(ended));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useFinishActivity(), { wrapper });
    act(() => result.current.finish());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${MISSION_ID}/participation/finish-activity`,
      expect.anything(),
    );
    expect(useSession.getState().participation?.status).toBe('assigned');
  });

  it('sends one request for a double tap', async () => {
    const fetch = vi.fn(async () => json(ended));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useFinishActivity(), { wrapper });
    act(() => {
      result.current.finish();
      result.current.finish();
    });
    await waitFor(() => expect(useSession.getState().participation?.status).toBe('ended'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the activity and the tracking when there is no connection, and says so', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network request failed');
      }),
    );
    const { result } = renderHook(() => useFinishActivity(), { wrapper });
    act(() => result.current.finish());
    await waitFor(() => expect(result.current.error).toBe('אין חיבור לשרת. הפעילות לא הסתיימה, נסו שוב.'));
    expect(useSession.getState()).toMatchObject({ participation: searching, tracking: true });
  });

  it('explains a refusal in Hebrew', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'NOT_FOUND', message: 'no' } }, 404)),
    );
    const { result } = renderHook(() => useFinishActivity(), { wrapper });
    act(() => result.current.finish());
    await waitFor(() => expect(result.current.error).toBe('הפעולה לא הושלמה. נסו שוב.'));
  });
});
