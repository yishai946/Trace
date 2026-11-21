import { type MissionStatus } from '@trace/domain';
import { Mission, MissionPolygon, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { missions, reports } from '../../db/schema';
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

export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
export const ID = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a87';

export const body = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  type: 'hazard',
  text: 'מדרון חלק',
  position: { type: 'Point', coordinates: [35.131, 31.775] },
  accuracy: 7.5,
  reportedAt: '2026-10-03T13:20:00+03:00',
  ...overrides,
});

/** Starts the app, signs in a commander and a searcher, and creates a mission with a polygon for each test. */
export function setupReports() {
  let ctx: TestContext;
  let commanderUser: TestUser;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;
  let polygon: MissionPolygon;
  let user: TestUser & { searcherId: string };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commanderUser = await signInCommander(ctx);
    commander = injectAs(ctx, commanderUser);
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
    const area = [
      [35.122, 31.77],
      [35.136, 31.77],
      [35.136, 31.781],
      [35.122, 31.781],
      [35.122, 31.77],
    ];
    polygon = MissionPolygon.parse(
      (
        await commander({
          method: 'POST',
          url: `/api/missions/${mission.id}/polygons`,
          payload: { geometry: { type: 'Polygon', coordinates: [area] } },
        })
      ).json(),
    );
    user = await signInSearcher(ctx);
    await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 4,
      searcherId: user.searcherId,
      polygonId: polygon.id,
    });
  });
  afterAll(() => ctx.close());

  const send = (payload: object = body(), as: TestUser | null = user, missionId = mission.id) =>
    as
      ? injectAs(ctx, as)({ method: 'POST', url: `/api/missions/${missionId}/reports`, payload })
      : ctx.app.inject({ method: 'POST', url: `/api/missions/${missionId}/reports`, payload });
  const putPhoto = (
    data: Buffer,
    contentType = 'image/jpeg',
    as: TestUser = user,
    reportId = ID,
    missionId = mission.id,
  ) =>
    injectAs(
      ctx,
      as,
    )({
      method: 'PUT',
      url: `/api/missions/${missionId}/reports/${reportId}/photo`,
      payload: data,
      headers: { 'content-type': contentType },
    });
  const rows = () => ctx.db.select().from(reports);
  const ID2 = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a88';
  const MISSING = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9aff';
  const asCommander = (options: Parameters<typeof commander>[0]) => commander(options);
  const reportUrl = (reportId = ID, missionId = mission.id) => `/api/missions/${missionId}/reports/${reportId}`;
  const list = (as: TestUser | null = commanderUser, missionId = mission.id) =>
    as
      ? injectAs(ctx, as)({ method: 'GET', url: `/api/missions/${missionId}/reports` })
      : ctx.app.inject({ method: 'GET', url: `/api/missions/${missionId}/reports` });
  const getPhoto = (as: TestUser = commanderUser, url = `${reportUrl()}/photo`) =>
    injectAs(ctx, as)({ method: 'GET', url });
  const handle = (as: TestUser = commanderUser, reportId = ID, missionId = mission.id) =>
    injectAs(ctx, as)({ method: 'POST', url: `${reportUrl(reportId, missionId)}/handle` });
  const patch = (payload: object, as: TestUser = commanderUser, reportId = ID, missionId = mission.id) =>
    injectAs(ctx, as)({ method: 'PATCH', url: reportUrl(reportId, missionId), payload });
  const del = (as: TestUser = commanderUser, reportId = ID, missionId = mission.id) =>
    injectAs(ctx, as)({ method: 'DELETE', url: reportUrl(reportId, missionId) });
  /** Runs `action` and returns the realtime events it published. */
  const capture = async (action: () => Promise<unknown>): Promise<MissionEvent[]> => {
    const published: MissionEvent[] = [];
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event, options) => {
      published.push(event);
      publish(event, options);
    };
    try {
      await action();
    } finally {
      ctx.realtime.publish = publish;
    }
    return published;
  };
  const reportEvents = (events: MissionEvent[]) => events.filter((e) => e.type.startsWith('report.'));
  const rowStatus = async () => (await rows()).find((r) => r.id === ID)?.status;
  const otherSearcher = async (callsign = 5) => {
    const other = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: mission.id, callsign, searcherId: other.searcherId });
    return other;
  };
  const createOtherMission = async (as: TestUser = commanderUser) =>
    Mission.parse(
      (
        await injectAs(
          ctx,
          as,
        )({
          method: 'POST',
          url: '/api/missions',
          payload: {
            name: 'אחר',
            rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
            lkp: {
              position: { type: 'Point', coordinates: [35.137, 31.769] },
              observedAt: '2026-10-03T13:05:00+03:00',
            },
          },
        })
      ).json(),
    );
  const makePolygonB = async () =>
    MissionPolygon.parse(
      (
        await commander({
          method: 'POST',
          url: `/api/missions/${mission.id}/polygons`,
          payload: {
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [35.15, 31.79],
                  [35.16, 31.79],
                  [35.16, 31.8],
                  [35.15, 31.8],
                  [35.15, 31.79],
                ],
              ],
            },
          },
        })
      ).json(),
    );
  const setStatus = (status: MissionStatus) =>
    ctx.db.update(missions).set({ status }).where(eq(missions.id, mission.id));

  return {
    get ctx() {
      return ctx;
    },
    get commanderUser() {
      return commanderUser;
    },
    get commander() {
      return commander;
    },
    get mission() {
      return mission;
    },
    get polygon() {
      return polygon;
    },
    get user() {
      return user;
    },
    send,
    putPhoto,
    rows,
    ID2,
    MISSING,
    asCommander,
    reportUrl,
    list,
    getPhoto,
    handle,
    patch,
    del,
    capture,
    reportEvents,
    rowStatus,
    otherSearcher,
    createOtherMission,
    makePolygonB,
    setStatus,
  };
}
