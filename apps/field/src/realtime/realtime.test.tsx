import type { JoinMissionAck, Mission } from '@trace/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY_MS, useMissionLive } from '.';
import { missionKeys } from '../mission/queries';
import { useSession } from '../state/session';

type Handler = (...args: never[]) => void;

/** Stands in for a Socket.IO client: the test fires its events and answers its joins. */
class FakeSocket {
  handlers = new Map<string, Handler[]>();
  joins: { missionId: string; ack: (result: JoinMissionAck) => void }[] = [];
  disconnected = false;
  connects = 0;
  constructor(
    readonly url: string,
    readonly options: { path: string; auth: { token: string } },
  ) {}
  on(name: string, handler: Handler) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
    return this;
  }
  emit(name: string, payload: { missionId: string }, ack: (result: JoinMissionAck) => void) {
    if (name === 'mission:join') this.joins.push({ missionId: payload.missionId, ack });
    return this;
  }
  connect() {
    this.connects++;
    return this;
  }
  disconnect() {
    this.disconnected = true;
    return this;
  }
  fire(name: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(name) ?? []) (handler as (...a: unknown[]) => void)(...args);
  }
}

const sockets = vi.hoisted(() => [] as unknown[]);
vi.mock('socket.io-client', () => ({
  io: (url: string, options: { path: string; auth: { token: string } }) => {
    const socket = new FakeSocket(url, options);
    sockets.push(socket);
    return socket;
  },
}));

const missionId = '00000000-0000-4000-8000-000000000001';
const mission: Mission = {
  id: missionId,
  name: 'מסע 0412',
  status: 'active',
  joinCode: 'K7-4Q2',
  missingPerson: {
    name: 'נועם אברהם',
    age: 74,
    disappearedAt: null,
    description: null,
    additionalInfo: null,
    photoUrl: null,
  },
  rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
  lkp: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
};

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(missionKeys.mission(missionId), mission);
  queryClient.setQueryData(missionKeys.polygons(missionId), []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useMissionLive(), { wrapper });
  return { ...view, queryClient, socket: sockets.at(-1) as FakeSocket | undefined };
}

const join = (socket: FakeSocket) =>
  act(() => {
    socket.fire('connect');
    socket.joins.at(-1)?.ack({ ok: true });
  });
const cached = (queryClient: QueryClient) => queryClient.getQueryData<Mission>(missionKeys.mission(missionId));

describe('useMissionLive', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    sockets.length = 0;
    useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true, missionId });
  });

  it('connects with the session token and joins the mission', () => {
    const { socket } = setup();
    expect(socket?.url).toBe('https://api.test');
    expect(socket?.options).toMatchObject({ path: '/api/realtime', auth: { token: 't1' } });
    socket?.fire('connect');
    expect(socket?.joins.map((j) => j.missionId)).toEqual([missionId]);
  });

  it('stays offline without a mission', () => {
    useSession.setState({ missionId: null });
    const { socket } = setup();
    expect(socket).toBeUndefined();
  });

  it('refetches the mission after every join, for changes made while away', async () => {
    const { socket, queryClient } = setup();
    await join(socket as FakeSocket);
    expect(queryClient.getQueryState(missionKeys.mission(missionId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(missionKeys.polygons(missionId))?.isInvalidated).toBe(true);
  });

  it('shows a new LKP and a moved rally point at once', async () => {
    const { socket, queryClient } = setup();
    const lkp = {
      position: { type: 'Point' as const, coordinates: [35.14, 31.77] as [number, number] },
      observedAt: '2026-10-03T14:22:00.000Z',
    };
    act(() => socket?.fire('mission:event', { type: 'lkp.changed', missionId, lkp }));
    expect(cached(queryClient)?.lkp).toEqual(lkp);

    const rallyPoint = { type: 'Point' as const, coordinates: [35.12, 31.79] as [number, number] };
    const updatedAt = '2026-10-03T14:30:00.000Z';
    act(() => socket?.fire('mission:event', { type: 'rally.changed', missionId, rallyPoint, updatedAt }));
    expect(cached(queryClient)).toMatchObject({ rallyPoint, updatedAt });
  });

  it('takes the edited mission details and refetches changed polygons', () => {
    const { socket, queryClient } = setup();
    const edited = { ...mission, name: 'מסע 0413' };
    act(() => socket?.fire('mission:event', { type: 'mission.updated', missionId, mission: edited }));
    expect(cached(queryClient)?.name).toBe('מסע 0413');

    act(() => socket?.fire('mission:event', { type: 'polygon.deleted', missionId, polygonId: missionId }));
    expect(queryClient.getQueryState(missionKeys.polygons(missionId))?.isInvalidated).toBe(true);
  });

  it('ignores an event of another mission or with an invalid payload', () => {
    const { socket, queryClient } = setup();
    const other = '00000000-0000-4000-8000-000000000009';
    act(() =>
      socket?.fire('mission:event', { type: 'mission.updated', missionId: other, mission: { ...mission, id: other } }),
    );
    act(() => socket?.fire('mission:event', { type: 'lkp.changed', missionId, lkp: 'nonsense' }));
    expect(cached(queryClient)).toEqual(mission);
  });

  it('signs out when the server refuses the session', async () => {
    const { socket } = setup();
    await act(async () => socket?.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useSession.getState().token).toBeNull();
  });

  it('tries the connection and the join again after a passing refusal', () => {
    vi.useFakeTimers();
    const { socket } = setup();
    act(() => socket?.fire('connect_error', new Error('INTERNAL_ERROR')));
    act(() => vi.advanceTimersByTime(RETRY_MS));
    expect(socket?.connects).toBe(1);

    act(() => {
      socket?.fire('connect');
      socket?.joins.at(-1)?.ack({ ok: false, code: 'INTERNAL_ERROR' });
    });
    act(() => vi.advanceTimersByTime(RETRY_MS));
    expect(socket?.joins).toHaveLength(2);
  });

  it('leaves the mission when the server no longer counts the searcher in it', () => {
    const { socket } = setup();
    act(() => {
      socket?.fire('connect');
      socket?.joins.at(-1)?.ack({ ok: false, code: 'NOT_FOUND' });
    });
    expect(useSession.getState().missionId).toBeNull();
  });

  it('connects again after the server closed the connection, and disconnects when the mission closes', () => {
    const { socket, unmount } = setup();
    act(() => socket?.fire('disconnect', 'io server disconnect'));
    expect(socket?.connects).toBe(1);
    unmount();
    expect(socket?.disconnected).toBe(true);
  });
});
