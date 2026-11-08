import type { JoinMissionAck, Mission, MissionEvent, MissionPolygon, Sighting, TimelineEvent } from '@trace/schemas';
import { QueryClient, QueryClientProvider, QueryObserver, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventSamples, mission, sightingA } from '../mission/fixtures';
import { missionKeys } from '../mission/missionQueries';
import { useMissionLive } from '.';

type Handler = (...args: never[]) => void;

/** Stands in for a Socket.IO client: the test fires its events and answers its joins. */
class FakeSocket {
  handlers = new Map<string, Handler[]>();
  joins: { missionId: string; ack: (result: JoinMissionAck) => void }[] = [];
  disconnected = false;
  connects = 0;

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

const sockets: FakeSocket[] = [];
vi.mock('socket.io-client', () => ({
  io: () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  },
}));

const missionId = '11111111-1111-4111-8111-111111111111';
const polygon = (id: string, name: string): MissionPolygon => ({
  id,
  missionId,
  name,
  status: 'unassigned',
  coverage: null,
  activeSearchers: 0,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [35.1, 31.7],
        [35.2, 31.7],
        [35.2, 31.8],
        [35.1, 31.7],
      ],
    ],
  },
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
});
const first = polygon('22222222-2222-4222-8222-222222222222', 'פוליגון 1');
const second = polygon('33333333-3333-4333-8333-333333333333', 'פוליגון 2');

/** The mission's polygons as the server has them; changes while the console is away. */
let serverPolygons: MissionPolygon[];
/** The mission's Timeline as the server has it, oldest first. */
let serverTimeline: TimelineEvent[];
/** Holds back the Timeline fetches, to fire an event while the first one is in flight. */
let timelineGate: Promise<void>;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetchPolygons = vi.fn(async () => serverPolygons);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => ({
      live: useMissionLive(missionId),
      polygons: useQuery({ queryKey: missionKeys.polygons(missionId), queryFn: fetchPolygons }).data,
      timeline: useQuery({
        queryKey: missionKeys.timeline(missionId),
        queryFn: async () => {
          // The server answers with what it has when asked, but the answer arrives once the gate opens.
          const snapshot = serverTimeline;
          await timelineGate;
          return snapshot;
        },
      }).data,
    }),
    { wrapper },
  );
  return { ...view, fetchPolygons, queryClient };
}

/** The socket connects and the server accepts the join. */
const connectAndJoin = (socket: FakeSocket) =>
  act(() => {
    socket.fire('connect');
    const join = socket.joins.at(-1);
    expect(join?.missionId).toBe(missionId);
    join?.ack({ ok: true });
  });

describe('useMissionLive', () => {
  beforeEach(() => {
    sockets.length = 0;
    serverPolygons = [first];
    serverTimeline = [];
    timelineGate = Promise.resolve();
  });

  it('is connecting until the join succeeds, then live', async () => {
    const { result } = setup();
    expect(result.current.live).toBe('connecting');
    const socket = sockets[0] as FakeSocket;
    await connectAndJoin(socket);
    expect(result.current.live).toBe('live');
  });

  it('refetches after the first join, for changes made while the first fetch ran', async () => {
    const { result, fetchPolygons } = setup();
    const socket = sockets[0] as FakeSocket;
    await waitFor(() => expect(result.current.polygons).toEqual([first]));
    serverPolygons = [first, second];
    await connectAndJoin(socket);
    await waitFor(() => expect(result.current.polygons).toEqual([first, second]));
    expect(fetchPolygons).toHaveBeenCalledTimes(2);
  });

  it('shows down when the join is refused', async () => {
    const { result } = setup();
    const socket = sockets[0] as FakeSocket;
    act(() => {
      socket.fire('connect');
      socket.joins[0]?.ack({ ok: false, code: 'NOT_FOUND' });
    });
    expect(result.current.live).toBe('down');
  });

  it('applies events to the cached polygons', async () => {
    const { result } = setup();
    const socket = sockets[0] as FakeSocket;
    await waitFor(() => expect(result.current.polygons).toEqual([first]));
    await connectAndJoin(socket);

    const renamed = { ...first, name: 'צפון' };
    const events: MissionEvent[] = [
      { type: 'polygon.saved', missionId, polygon: renamed },
      { type: 'polygon.saved', missionId, polygon: second },
    ];
    act(() => events.forEach((event) => socket.fire('mission:event', event)));
    // Query observers are notified on the next tick.
    await waitFor(() => expect(result.current.polygons).toEqual([renamed, second]));

    act(() => socket.fire('mission:event', { type: 'polygon.deleted', missionId, polygonId: first.id }));
    await waitFor(() => expect(result.current.polygons).toEqual([second]));
  });

  it('adds a recorded event to the cached Timeline once, in time order', async () => {
    const e1: TimelineEvent = { ...eventSamples['polygon.created'], missionId };
    serverTimeline = [e1];
    const { result } = setup();
    const socket = sockets[0] as FakeSocket;
    const e2: TimelineEvent = { ...eventSamples['polygon.deleted'], missionId };
    const earlier: TimelineEvent = {
      ...eventSamples['lkp.changed'],
      missionId,
      occurredAt: '2026-10-03T09:00:00.000Z',
    };
    await waitFor(() => expect(result.current.timeline).toEqual([e1]));

    const recorded = (event: TimelineEvent): MissionEvent => ({ type: 'timeline.recorded', missionId, event });
    act(() => {
      socket.fire('mission:event', recorded(e2));
      socket.fire('mission:event', recorded(e2));
    });
    await waitFor(() => expect(result.current.timeline).toEqual([e1, e2]));

    act(() => socket.fire('mission:event', recorded(earlier)));
    await waitFor(() => expect(result.current.timeline).toEqual([earlier, e1, e2]));

    // Same instant as e1: it goes after it, as the API orders ties by recording order.
    const tie: TimelineEvent = { ...eventSamples['mission.paused'], missionId, occurredAt: e1.occurredAt };
    act(() => socket.fire('mission:event', recorded(tie)));
    await waitFor(() => expect(result.current.timeline).toEqual([earlier, e1, tie, e2]));
  });

  it('keeps a Timeline event that arrives while the first fetch is in flight', async () => {
    let open: () => void = () => {};
    timelineGate = new Promise((resolve) => (open = resolve));
    const { result } = setup();
    const socket = sockets[0] as FakeSocket;

    // The first fetch has asked the server and is waiting; then the event is recorded and published.
    const recorded: TimelineEvent = { ...eventSamples['polygon.created'], missionId };
    serverTimeline = [recorded];
    act(() => socket.fire('mission:event', { type: 'timeline.recorded', missionId, event: recorded }));
    open();

    await waitFor(() => expect(result.current.timeline).toEqual([recorded]));
  });

  describe('rally point', () => {
    const otherMission = { ...mission, id: '44444444-4444-4444-8444-444444444444' };
    const moved = { type: 'Point', coordinates: [35.15, 31.8] } as const;
    const event = (overrides: object = {}) => ({
      type: 'rally.changed',
      missionId: mission.id,
      rallyPoint: moved,
      updatedAt: '2026-11-02T09:00:00.000Z',
      ...overrides,
    });

    function setupMissions() {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData<Mission[]>(missionKeys.all, [mission, otherMission]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      renderHook(() => useMissionLive(mission.id), { wrapper });
      return queryClient;
    }

    it('updates the cached mission', async () => {
      const queryClient = setupMissions();
      const socket = sockets[0] as FakeSocket;
      act(() => socket.fire('mission:event', event()));
      await waitFor(() => {
        const [updated, untouched] = queryClient.getQueryData<Mission[]>(missionKeys.all) ?? [];
        expect(updated).toEqual({ ...mission, rallyPoint: moved, updatedAt: '2026-11-02T09:00:00.000Z' });
        expect(untouched).toEqual(otherMission);
      });
    });

    it('ignores an event of another mission or with an invalid payload', async () => {
      const queryClient = setupMissions();
      const socket = sockets[0] as FakeSocket;
      act(() => {
        socket.fire('mission:event', event({ missionId: otherMission.id }));
        socket.fire('mission:event', event({ rallyPoint: { type: 'Point', coordinates: [35, 95] } }));
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(queryClient.getQueryData<Mission[]>(missionKeys.all)).toEqual([mission, otherMission]);
    });
  });

  describe('mission details', () => {
    const otherMission = { ...mission, id: '44444444-4444-4444-8444-444444444444' };
    const edited = {
      ...mission,
      name: 'מסע 0413',
      missingPerson: { ...mission.missingPerson, description: 'מעיל חום' },
    };
    const event = (overrides: object = {}) => ({
      type: 'mission.updated',
      missionId: mission.id,
      mission: edited,
      ...overrides,
    });

    function setupMissions() {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData<Mission[]>(missionKeys.all, [mission, otherMission]);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      renderHook(() => useMissionLive(mission.id), { wrapper });
      return queryClient;
    }

    it('replaces the cached mission', async () => {
      const queryClient = setupMissions();
      const socket = sockets[0] as FakeSocket;
      act(() => socket.fire('mission:event', event()));
      await waitFor(() => {
        const [updated, untouched] = queryClient.getQueryData<Mission[]>(missionKeys.all) ?? [];
        expect(updated).toEqual(edited);
        expect(untouched).toEqual(otherMission);
      });
    });

    it('ignores an event of another mission or with an invalid payload', async () => {
      const queryClient = setupMissions();
      const socket = sockets[0] as FakeSocket;
      act(() => {
        socket.fire('mission:event', event({ missionId: otherMission.id }));
        socket.fire('mission:event', event({ mission: { ...edited, status: 'unknown' } }));
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(queryClient.getQueryData<Mission[]>(missionKeys.all)).toEqual([mission, otherMission]);
    });
  });

  it('shows down while disconnected, and refetches the latest data after reconnecting', async () => {
    const { result, fetchPolygons } = setup();
    const socket = sockets[0] as FakeSocket;
    await waitFor(() => expect(result.current.polygons).toEqual([first]));
    await connectAndJoin(socket);
    await waitFor(() => expect(fetchPolygons).toHaveBeenCalledTimes(2));

    act(() => socket.fire('disconnect', 'transport close'));
    expect(result.current.live).toBe('down');

    // A polygon was drawn while the console was away; its event never arrived.
    serverPolygons = [first, second];
    await connectAndJoin(socket);
    expect(result.current.live).toBe('live');
    await waitFor(() => expect(result.current.polygons).toEqual([first, second]));
    expect(fetchPolygons).toHaveBeenCalledTimes(3);
  });

  it('connects again after the server closed the connection, as on a restart', async () => {
    const { result } = setup();
    const socket = sockets[0] as FakeSocket;
    await connectAndJoin(socket);

    act(() => socket.fire('disconnect', 'io server disconnect'));
    expect(result.current.live).toBe('down');
    expect(socket.connects).toBe(1);

    await connectAndJoin(socket);
    expect(result.current.live).toBe('live');
  });

  it('closes the connection when the mission closes', () => {
    const { unmount } = setup();
    unmount();
    expect(sockets[0]?.disconnected).toBe(true);
  });

  it('adds a saved sighting to the cached sightings, and replaces it on a second event', async () => {
    const { queryClient } = setup();
    const socket = sockets[0] as FakeSocket;
    await connectAndJoin(socket);
    queryClient.setQueryData<Sighting[]>(missionKeys.sightings(missionId), []);

    act(() => socket.fire('mission:event', { type: 'sighting.saved', missionId, sighting: sightingA }));
    expect(queryClient.getQueryData(missionKeys.sightings(missionId))).toEqual([sightingA]);

    const decided = { ...sightingA, lkpDecision: 'rejected' as const, lkpCandidate: false };
    act(() => socket.fire('mission:event', { type: 'sighting.saved', missionId, sighting: decided }));
    expect(queryClient.getQueryData(missionKeys.sightings(missionId))).toEqual([decided]);
  });

  it('updates the mission’s LKP and refetches the history when the LKP changes', async () => {
    const { queryClient } = setup();
    const socket = sockets[0] as FakeSocket;
    await connectAndJoin(socket);
    const current = { ...mission, id: missionId };
    queryClient.setQueryData<Mission[]>(missionKeys.all, [current]);
    queryClient.setQueryData(missionKeys.lkps(missionId), []);
    queryClient.setQueryData(missionKeys.sightings(missionId), []);

    const lkp = { position: sightingA.position, observedAt: sightingA.observedAt };
    act(() => socket.fire('mission:event', { type: 'lkp.changed', missionId, lkp }));

    expect(queryClient.getQueryData<Mission[]>(missionKeys.all)?.[0]?.lkp).toEqual(lkp);
    expect(queryClient.getQueryState(missionKeys.lkps(missionId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(missionKeys.sightings(missionId))?.isInvalidated).toBe(true);
  });

  it('refetches the mission list after every join, for an LKP that changed while away', async () => {
    const { queryClient } = setup();
    const socket = sockets[0] as FakeSocket;
    const fetchMissions = vi.fn(async () => [{ ...mission, id: missionId }]);
    // The missions list is on screen, so it has an active observer.
    const observer = new QueryObserver(queryClient, { queryKey: missionKeys.all, queryFn: fetchMissions });
    const unsubscribe = observer.subscribe(() => undefined);
    await waitFor(() => expect(fetchMissions).toHaveBeenCalledTimes(1));
    await connectAndJoin(socket);
    await waitFor(() => expect(fetchMissions).toHaveBeenCalledTimes(2));
    unsubscribe();
  });
});
