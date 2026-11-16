import type { MissionEvent } from '@trace/schemas';
import {
  LkpDecisionResult,
  Mission,
  MissionPolygon,
  REALTIME_PATH,
  Sighting,
  type ClientToServerEvents,
  type JoinMissionAck,
  type ServerToClientEvents,
} from '@trace/schemas';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest';
import { createTestApp, injectAs, resetDb, type TestContext, type TestUser } from '../testing';

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

export const rallyPoint = { type: 'Point', coordinates: [35.13, 31.78] };
export const lkp = {
  position: { type: 'Point', coordinates: [35.137, 31.769] },
  observedAt: '2026-10-03T13:05:00+03:00',
};
export const area = {
  type: 'Polygon',
  coordinates: [
    [
      [35.122, 31.77],
      [35.136, 31.77],
      [35.136, 31.781],
      [35.122, 31.781],
      [35.122, 31.77],
    ],
  ],
};

/** Time to wait before concluding that an event will not arrive. */
export const QUIET_MS = 300;

/** Starts the app and the database for the tests of this file, and gives them the helpers that talk to it. */
export function setupRealtime() {
  let ctx: TestContext;
  let url: string;
  const clients: Client[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    url = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  });
  beforeEach(() => resetDb(ctx.db));
  afterEach(() => {
    for (const client of clients.splice(0)) client.disconnect();
  });
  afterAll(() => ctx.close());

  /** A socket that signs in the way the user's app does: Command with the cookie, Field with `auth.token`. */
  const socketFor = (user: TestUser | null): Client => {
    const bearer = user?.headers.authorization?.replace(/^Bearer /, '');
    const client: Client = io(url, {
      path: REALTIME_PATH,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: user?.headers.cookie ? { cookie: user.headers.cookie } : {},
      auth: bearer ? { token: bearer } : {},
    });
    clients.push(client);
    return client;
  };

  const connect = (client: Client) =>
    new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', reject);
    });

  const join = (client: Client, missionId: string) =>
    new Promise<JoinMissionAck>((resolve) => client.emit('mission:join', { missionId }, resolve));

  /** Collects every mission event the client receives from now on. */
  const record = (client: Client) => {
    const events: MissionEvent[] = [];
    client.on('mission:event', (event) => events.push(event));
    return events;
  };

  const settle = () => new Promise((resolve) => setTimeout(resolve, QUIET_MS));

  const nextEvent = (client: Client) => new Promise<MissionEvent>((resolve) => client.once('mission:event', resolve));

  const createMissionAs = async (user: TestUser) => {
    const res = await injectAs(
      ctx,
      user,
    )({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } });
    expect(res.statusCode).toBe(201);
    return Mission.parse(res.json());
  };

  const createPolygonAs = async (user: TestUser, missionId: string) => {
    const res = await injectAs(
      ctx,
      user,
    )({
      method: 'POST',
      url: `/api/missions/${missionId}/polygons`,
      payload: { geometry: area },
    });
    expect(res.statusCode).toBe(201);
    return MissionPolygon.parse(res.json());
  };

  const createSightingAs = async (user: TestUser, missionId: string) => {
    const res = await injectAs(
      ctx,
      user,
    )({
      method: 'POST',
      url: `/api/missions/${missionId}/sightings`,
      payload: {
        position: { type: 'Point', coordinates: [35.14, 31.77] },
        observedAt: '2026-10-03T14:22:00+03:00',
        source: 'witness',
      },
    });
    expect(res.statusCode).toBe(201);
    return Sighting.parse(res.json());
  };

  const decideAs = async (user: TestUser, missionId: string, sightingId: string, decision: 'accepted' | 'rejected') => {
    const res = await injectAs(
      ctx,
      user,
    )({
      method: 'PUT',
      url: `/api/missions/${missionId}/sightings/${sightingId}/lkp-decision`,
      payload: { decision },
    });
    expect(res.statusCode).toBe(200);
    return LkpDecisionResult.parse(res.json());
  };

  return {
    get ctx() {
      return ctx;
    },
    socketFor,
    connect,
    join,
    record,
    settle,
    nextEvent,
    createMissionAs,
    createPolygonAs,
    createSightingAs,
    decideAs,
  };
}
