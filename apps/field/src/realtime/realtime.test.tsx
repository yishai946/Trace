import type { JoinMissionAck, Mission, Report } from '@trace/schemas';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY_MS, useMissionLive } from '.';
import { missionKeys } from '../mission/queries';
import { makeReport } from '../reports/fixtures';
import { makeMessage } from '../messages/fixtures';
import { makeSos } from '../sos/fixtures';
import { clearOfflinePackages } from '../offline/store';
import { requestOfflineRefresh } from '../offline/refreshPackage';
import { useSession } from '../state/session';
import { syncOutbox } from '../tracking';

vi.mock('../tracking', () => ({ syncOutbox: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../offline/store', () => ({ clearOfflinePackages: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../offline/refreshPackage', () => ({ requestOfflineRefresh: vi.fn().mockResolvedValue(undefined) }));

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
  commander: { name: 'ישי', phoneNumber: null },
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
  located: null,
  stopped: null,
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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('uploads what waited offline before it downloads the updates (UC-S03)', async () => {
    let uploaded!: () => void;
    vi.mocked(syncOutbox).mockReturnValueOnce(new Promise<void>((resolve) => (uploaded = resolve)));
    const { socket, queryClient } = setup();
    await join(socket as FakeSocket);
    expect(syncOutbox).toHaveBeenCalled();
    expect(queryClient.getQueryState(missionKeys.mission(missionId))?.isInvalidated).toBe(false);
    expect(requestOfflineRefresh).not.toHaveBeenCalled();
    await act(async () => uploaded());
    expect(queryClient.getQueryState(missionKeys.mission(missionId))?.isInvalidated).toBe(true);
    expect(requestOfflineRefresh).toHaveBeenCalledWith(expect.objectContaining({ missionId, token: 't1' }));
  });

  it('does not download after the searcher left while the upload ran', async () => {
    let uploaded!: () => void;
    vi.mocked(syncOutbox).mockReturnValueOnce(new Promise<void>((resolve) => (uploaded = resolve)));
    const { socket, unmount } = setup();
    await join(socket as FakeSocket);
    unmount();
    await act(async () => uploaded());
    expect(requestOfflineRefresh).not.toHaveBeenCalled();
  });

  it('refreshes the saved offline package after every join, for edits made while offline', async () => {
    const { socket } = setup();
    await join(socket as FakeSocket);
    expect(requestOfflineRefresh).toHaveBeenCalledWith(expect.objectContaining({ missionId, token: 't1' }));
  });

  it.each([
    ['mission.updated', { mission }],
    ['rally.changed', { rallyPoint: mission.rallyPoint, updatedAt: '2026-10-03T14:30:00.000Z' }],
    [
      'lkp.changed',
      { lkp: { position: { type: 'Point', coordinates: [35.14, 31.77] }, observedAt: '2026-10-03T14:22:00.000Z' } },
    ],
    ['polygon.deleted', { polygonId: '00000000-0000-4000-8000-0000000000a1' }],
  ])('refreshes the saved offline package on %s', (type, rest) => {
    const { socket } = setup();
    vi.mocked(requestOfflineRefresh).mockClear();
    act(() => socket?.fire('mission:event', { type, missionId, ...rest }));
    expect(requestOfflineRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the offline package for an event that does not change it', () => {
    const { socket } = setup();
    vi.mocked(requestOfflineRefresh).mockClear();
    act(() => socket?.fire('mission:event', { type: 'sos.saved', missionId, sos: makeSos() }));
    expect(requestOfflineRefresh).not.toHaveBeenCalled();
  });

  it('stops a refresh in flight when the searcher leaves', async () => {
    const { socket, unmount } = setup();
    await join(socket as FakeSocket);
    const signal = vi.mocked(requestOfflineRefresh).mock.calls.at(-1)?.[0].signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
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

  it("takes the searcher's own assignment, and reads it again after a join", async () => {
    const own = {
      id: '00000000-0000-4000-8000-000000000002',
      callsign: 7,
      status: 'available' as const,
      polygonId: null,
      taskStatus: null,
    };
    useSession.setState({ participation: own });
    const { socket } = setup();
    const participant = {
      ...own,
      searcherId: '00000000-0000-4000-8000-000000000105',
      name: 'דנה כהן',
      phone: '+972526114085',
      status: 'assigned',
      polygonId: '00000000-0000-4000-8000-0000000000a1',
      taskStatus: 'ready',
      position: null,
      positionAt: null,
    };
    act(() => socket?.fire('mission:event', { type: 'participant.updated', missionId, participant }));
    expect(useSession.getState()).toMatchObject({
      participation: { status: 'assigned', polygonId: participant.polygonId, taskStatus: 'ready' },
      assignmentNotice: { kind: 'assigned', polygonId: participant.polygonId },
    });

    const fetch = vi.fn(
      async () => new Response(JSON.stringify(own), { headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetch);
    await join(socket as FakeSocket);
    await vi.waitFor(() => expect(useSession.getState().participation?.status).toBe('available'));
    expect(fetch).toHaveBeenCalledWith(`https://api.test/api/missions/${missionId}/participation`, expect.anything());
  });

  it('drops a refetch that answers after a live event or after the screen closed', async () => {
    const own = {
      id: '00000000-0000-4000-8000-000000000002',
      callsign: 7,
      status: 'available' as const,
      polygonId: null,
      taskStatus: null,
    };
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    const assigned = {
      ...own,
      status: 'assigned' as const,
      polygonId: '00000000-0000-4000-8000-0000000000a1',
      taskStatus: 'ready' as const,
    };
    useSession.setState({ participation: own });
    const { socket, unmount } = setup();
    await join(socket as FakeSocket);
    act(() =>
      socket?.fire('mission:event', {
        type: 'participant.updated',
        missionId,
        participant: {
          ...assigned,
          searcherId: own.id,
          name: 'דנה',
          phone: '+972526114085',
          position: null,
          positionAt: null,
        },
      }),
    );
    unmount();
    await act(async () =>
      answer(new Response(JSON.stringify(own), { headers: { 'content-type': 'application/json' } })),
    );

    expect(useSession.getState().participation?.status).toBe('assigned');
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

  it('drops the offline package of a mission the searcher is no longer in', () => {
    const { socket } = setup();
    act(() => {
      socket?.fire('connect');
      socket?.joins.at(-1)?.ack({ ok: false, code: 'NOT_FOUND' });
    });
    expect(clearOfflinePackages).toHaveBeenCalled();
  });

  it('connects again after the server closed the connection, and disconnects when the mission closes', () => {
    const { socket, unmount } = setup();
    act(() => socket?.fire('disconnect', 'io server disconnect'));
    expect(socket?.connects).toBe(1);
    unmount();
    expect(socket?.disconnected).toBe(true);
  });
});

describe('useMissionLive: reports (UC-F11)', () => {
  const cachedReports = (queryClient: QueryClient) =>
    queryClient.getQueryData<Report[]>(missionKeys.reports(missionId));
  const reportsState = (queryClient: QueryClient) => queryClient.getQueryState(missionKeys.reports(missionId));
  const own = {
    id: '00000000-0000-4000-8000-000000000002',
    callsign: 7,
    status: 'assigned' as const,
    polygonId: '00000000-0000-4000-8000-0000000000a1',
    taskStatus: 'searching' as const,
  };
  const participantEvent = (changes: Record<string, unknown>) => ({
    type: 'participant.updated',
    missionId,
    participant: {
      ...own,
      ...changes,
      searcherId: '00000000-0000-4000-8000-000000000105',
      name: 'דנה',
      phone: '+972526114085',
      position: null,
      positionAt: null,
    },
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    sockets.length = 0;
    useSession.setState({
      ...useSession.getInitialState(),
      token: 't1',
      restored: true,
      missionId,
      participation: own,
    });
  });

  it('adds a saved report to the cached list, newest first, and replaces an edited one', () => {
    const { socket, queryClient } = setup();
    const older = makeReport({ reportedAt: '2026-10-03T10:00:00.000Z' });
    queryClient.setQueryData(missionKeys.reports(missionId), [older]);
    const newer = makeReport({ reportedAt: '2026-10-03T12:00:00.000Z' });
    act(() => socket?.fire('mission:event', { type: 'report.saved', missionId, report: newer }));
    expect(cachedReports(queryClient)?.map((r) => r.id)).toEqual([newer.id, older.id]);

    const edited = { ...older, text: 'עודכן' };
    act(() => socket?.fire('mission:event', { type: 'report.saved', missionId, report: edited }));
    expect(cachedReports(queryClient)).toHaveLength(2);
    expect(cachedReports(queryClient)?.find((r) => r.id === older.id)?.text).toBe('עודכן');
  });

  it('removes a deleted report from the cached list', () => {
    const { socket, queryClient } = setup();
    const report = makeReport();
    const other = makeReport();
    queryClient.setQueryData(missionKeys.reports(missionId), [report, other]);
    act(() => socket?.fire('mission:event', { type: 'report.deleted', missionId, reportId: report.id }));
    expect(cachedReports(queryClient)?.map((r) => r.id)).toEqual([other.id]);
  });

  it('shows an SOS the searcher sent, and its closing by the commander, at once', () => {
    const { socket, queryClient } = setup();
    const key = missionKeys.sos(missionId);
    queryClient.setQueryData(key, []);
    const active = makeSos();
    act(() => socket?.fire('mission:event', { type: 'sos.saved', missionId, sos: active }));
    expect(queryClient.getQueryData(key)).toEqual([active]);

    const closed = makeSos({
      status: 'closed',
      closedAt: '2026-10-03T17:10:00.000Z',
      closedBy: { role: 'commander', name: 'רן' },
    });
    act(() => socket?.fire('mission:event', { type: 'sos.saved', missionId, sos: closed }));
    expect(queryClient.getQueryData(key)).toEqual([closed]);
  });

  it('refetches the SOS list after every join', async () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(missionKeys.sos(missionId), []);
    await join(socket as FakeSocket);
    expect(queryClient.getQueryState(missionKeys.sos(missionId))?.isInvalidated).toBe(true);
  });

  it('shows a message sent to the searcher at once, newest first', () => {
    const { socket, queryClient } = setup();
    const key = missionKeys.messages(missionId);
    const older = makeMessage({ sentAt: '2026-10-03T16:00:00.000Z' });
    queryClient.setQueryData(key, [older]);
    const message = makeMessage();
    const event = { type: 'message.received', missionId, searcherId: '00000000-0000-4000-8000-0000000000c3', message };
    act(() => socket?.fire('mission:event', event));
    act(() => socket?.fire('mission:event', event));
    expect(queryClient.getQueryData(key)).toEqual([message, older]);
  });

  it('refetches the messages after every join, for those sent while offline', async () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(missionKeys.messages(missionId), []);
    await join(socket as FakeSocket);
    expect(queryClient.getQueryState(missionKeys.messages(missionId))?.isInvalidated).toBe(true);
  });

  it('shows a message sent while offline once the connection is back (UC-S03)', async () => {
    const { socket, queryClient } = setup();
    const sentWhileOffline = makeMessage();
    let held = [] as ReturnType<typeof makeMessage>[];
    // The open Messages screen watches the list; the server answers with what it kept for the searcher.
    const observer = new QueryObserver(queryClient, {
      queryKey: missionKeys.messages(missionId),
      queryFn: async () => held,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual([]));
    held = [sentWhileOffline];
    await join(socket as FakeSocket);
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual([sentWhileOffline]));
    unsubscribe();
  });

  it('refetches instead of writing when the list is not cached', async () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(missionKeys.reports(missionId), undefined);
    const observer = queryClient.getQueryCache().build(queryClient, { queryKey: missionKeys.reports(missionId) });
    act(() => socket?.fire('mission:event', { type: 'report.saved', missionId, report: makeReport() }));
    await vi.waitFor(() => expect(observer.state.isInvalidated).toBe(true));
    expect(cachedReports(queryClient)).toBeUndefined();
    act(() => socket?.fire('mission:event', { type: 'report.deleted', missionId, reportId: makeReport().id }));
    expect(cachedReports(queryClient)).toBeUndefined();
  });

  it('refetches the reports when the searcher moves to another polygon or is unassigned', () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(missionKeys.reports(missionId), []);
    act(() => socket?.fire('mission:event', participantEvent({ polygonId: '00000000-0000-4000-8000-0000000000b2' })));
    expect(reportsState(queryClient)?.isInvalidated).toBe(true);

    queryClient.setQueryData(missionKeys.reports(missionId), []);
    act(() => socket?.fire('mission:event', participantEvent({ polygonId: null, status: 'available' })));
    expect(reportsState(queryClient)?.isInvalidated).toBe(true);
  });

  it('does not refetch the reports when the polygon and the status stay the same', () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(missionKeys.reports(missionId), []);
    act(() => socket?.fire('mission:event', participantEvent({ taskStatus: 'paused' })));
    expect(reportsState(queryClient)?.isInvalidated).toBe(false);
  });

  it('refetches the reports after every join, for events sent while away', async () => {
    const { socket, queryClient } = setup();
    queryClient.setQueryData(missionKeys.reports(missionId), []);
    await join(socket as FakeSocket);
    expect(reportsState(queryClient)?.isInvalidated).toBe(true);
  });
});
