import { Mission, MissionPolygon, Sos } from '@trace/schemas';
import type { Polygon } from 'geojson';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
  type TestUser,
} from '../../testing';

const box = (west: number, south: number, east: number, north: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});
const tokenOf = (n: string) => `ExponentPushToken[${n}]`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('SOS push (UC-F13)', () => {
  let ctx: TestContext;
  let commanderUser: TestUser;
  let mission: Mission;
  let sender: TestUser & { searcherId: string };
  let available: TestUser & { searcherId: string };
  let polygonA: MissionPolygon;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  const putToken = (user: TestUser, name: string) =>
    injectAs(ctx, user)({ method: 'PUT', url: '/api/push-token', payload: { token: tokenOf(name) } });
  const activate = (user: TestUser = sender, payload: object = {}) =>
    injectAs(ctx, user)({ method: 'POST', url: `/api/missions/${mission.id}/sos`, payload });
  const close = (id: string, user: TestUser = sender) =>
    injectAs(ctx, user)({ method: 'POST', url: `/api/missions/${mission.id}/sos/${id}/close` });
  const tokensSent = () => ctx.pushSender.sent.flatMap((s) => s.tokens).sort();

  beforeEach(async () => {
    await resetDb(ctx.db);
    ctx.pushSender.sent.length = 0;
    commanderUser = await signInCommander(ctx);
    const commander = injectAs(ctx, commanderUser);
    mission = Mission.parse(
      (
        await commander({
          method: 'POST',
          url: '/api/missions',
          payload: {
            name: 'מסע',
            rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
            lkp: {
              position: { type: 'Point', coordinates: [35.137, 31.769] },
              observedAt: '2026-10-03T13:05:00+03:00',
            },
          },
        })
      ).json(),
    );
    const polygon = async (name: string, geometry: Polygon) =>
      MissionPolygon.parse(
        (
          await commander({ method: 'POST', url: `/api/missions/${mission.id}/polygons`, payload: { name, geometry } })
        ).json(),
      );
    polygonA = await polygon('A', box(35.122, 31.77, 35.136, 31.781));
    const polygonB = await polygon('B', box(35.15, 31.77, 35.16, 31.78));
    const join = async (name: string, callsign: number, polygonId?: string) => {
      const user = await signInSearcher(ctx, { name });
      await addParticipant(ctx.db, { missionId: mission.id, callsign, searcherId: user.searcherId, polygonId });
      await putToken(user, name);
      return user;
    };
    sender = await join('sender', 7, polygonA.id);
    await join('a1', 1, polygonA.id);
    await join('b1', 2, polygonB.id);
    available = await join('available', 3);
  });

  it('sends the activation once to the polygon’s other searchers', async () => {
    const res = await activate(sender, { message: 'נפלתי' });
    expect(res.statusCode).toBe(201);
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    expect(ctx.pushSender.sent[0]?.tokens).toEqual([tokenOf('a1')]);
    expect(ctx.pushSender.sent[0]?.message).toEqual({
      title: 'SOS · sender',
      body: 'נפלתי',
      data: { missionId: mission.id, screen: 'sos' },
    });
  });

  it('uses the polygon name when there is no message', async () => {
    await activate();
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    expect(ctx.pushSender.sent[0]?.message.body).toBe('נדרש סיוע מיידי בפוליגון A');
  });

  it('sends nothing when it is activated again', async () => {
    await activate();
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    expect((await activate()).statusCode).toBe(200);
    await settle();
    expect(ctx.pushSender.sent).toHaveLength(1);
  });

  it('sends nothing for a sender without a polygon', async () => {
    expect((await activate(available)).statusCode).toBe(201);
    await settle();
    expect(ctx.pushSender.sent).toHaveLength(0);
  });

  it('sends the closing update to the recipients when the sender closes', async () => {
    const sos = Sos.parse((await activate()).json());
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    ctx.pushSender.sent.length = 0;
    expect((await close(sos.id)).statusCode).toBe(200);
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    expect(tokensSent()).toEqual([tokenOf('a1')]);
    expect(ctx.pushSender.sent[0]?.message).toEqual({
      title: 'SOS נסגר · sender',
      body: 'ה־SOS נסגר.',
      data: { missionId: mission.id, screen: 'sos' },
    });
  });

  it('sends the closing update to the recipients and the sender when the commander closes', async () => {
    const sos = Sos.parse((await activate()).json());
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    ctx.pushSender.sent.length = 0;
    await close(sos.id, commanderUser);
    await vi.waitFor(() => expect(tokensSent()).toEqual([tokenOf('a1'), tokenOf('sender')]));
  });

  it('sends nothing when it is closed again', async () => {
    const sos = Sos.parse((await activate()).json());
    await close(sos.id);
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(2));
    await close(sos.id);
    await settle();
    expect(ctx.pushSender.sent).toHaveLength(2);
  });

  it('a push failure does not fail the activation', async () => {
    ctx.pushSender.failNext(new Error('down'));
    expect((await activate()).statusCode).toBe(201);
  });
});
