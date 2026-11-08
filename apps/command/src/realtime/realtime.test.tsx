import type { JoinMissionAck, MissionEvent, MissionPolygon, TimelineEvent } from '@trace/schemas';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventSamples } from '../mission/fixtures';
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
      timeline: useQuery({ queryKey: missionKeys.timeline(missionId), queryFn: async () => serverTimeline }).data,
    }),
    { wrapper },
  );
  return { ...view, fetchPolygons };
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
});
