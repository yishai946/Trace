import { MAX_PHOTO_BYTES, type MissionStatus } from '@trace/domain';
import { ApiError, Mission, MissionPolygon, Report, TimelineEvent, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, reportPhotos, reports, timelineEvents } from '../../db/schema';
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

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const ID = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a87';

const body = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  type: 'hazard',
  text: 'מדרון חלק',
  position: { type: 'Point', coordinates: [35.131, 31.775] },
  accuracy: 7.5,
  reportedAt: '2026-10-03T13:20:00+03:00',
  ...overrides,
});

describe('field reports (UC-F09)', () => {
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
  const setStatus = (status: MissionStatus) =>
    ctx.db.update(missions).set({ status }).where(eq(missions.id, mission.id));

  describe('sending a report', () => {
    it('saves a valid report as New with its location and the searcher polygon', async () => {
      const res = await send();
      expect(res.statusCode).toBe(201);
      const report = Report.parse(res.json());
      expect(report).toMatchObject({
        id: ID,
        missionId: mission.id,
        polygonId: polygon.id,
        type: 'hazard',
        status: 'new',
        text: 'מדרון חלק',
        position: { type: 'Point', coordinates: [35.131, 31.775] },
        accuracy: 7.5,
        hasPhoto: false,
        reportedBy: { role: 'searcher', callsign: 4 },
      });
      expect(Date.parse(report.reportedAt)).toBe(Date.parse('2026-10-03T13:20:00+03:00'));
      expect(await rows()).toHaveLength(1);
    });

    it('refuses an unknown type', async () => {
      const res = await send(body({ type: 'rumor' }));
      expect(res.statusCode).toBe(400);
      expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
      expect(await rows()).toHaveLength(0);
    });

    it('creates no second report when the same id is sent again', async () => {
      const published: MissionEvent[] = [];
      const publish = ctx.realtime.publish.bind(ctx.realtime);
      ctx.realtime.publish = (event) => {
        published.push(event);
        publish(event);
      };
      const first = await send();
      const second = await send();
      ctx.realtime.publish = publish;

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual(first.json());
      expect(await rows()).toHaveLength(1);
      const events = await ctx.db.select().from(timelineEvents).where(eq(timelineEvents.type, 'report.submitted'));
      expect(events).toHaveLength(1);
      expect(published.filter((e) => e.type === 'timeline.recorded')).toHaveLength(1);
    });

    it('refuses an id that belongs to another searcher, leaving the original', async () => {
      await send();
      const other = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 5, searcherId: other.searcherId });
      const res = await send(body({ text: 'אחר' }), other);
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('REPORT_ID_TAKEN');
      const [row] = await rows();
      expect(row?.text).toBe('מדרון חלק');
    });

    it('refuses blank or too long text and saves text trimmed', async () => {
      expect((await send(body({ text: '' }))).statusCode).toBe(400);
      expect((await send(body({ text: '   ' }))).statusCode).toBe(400);
      expect((await send(body({ text: 'א'.repeat(2001) }))).statusCode).toBe(400);
      expect(await rows()).toHaveLength(0);
      const res = await send(body({ text: '  מדרון חלק  ' }));
      expect(Report.parse(res.json()).text).toBe('מדרון חלק');
    });

    it('requires a position and a uuid id', async () => {
      const { position: _position, ...withoutPosition } = body();
      expect((await send(withoutPosition)).statusCode).toBe(400);
      expect((await send(body({ id: 'nope' }))).statusCode).toBe(400);
    });

    it('answers 404 to a searcher outside the mission, 403 to the commander and 401 without a session', async () => {
      const outsider = await signInSearcher(ctx);
      expect((await send(body(), outsider)).statusCode).toBe(404);
      expect((await send(body(), commanderUser)).statusCode).toBe(403);
      expect((await send(body(), null)).statusCode).toBe(401);
    });

    it.each(['ended_located', 'ended_stopped'] as const)('refuses a mission that is %s', async (status) => {
      await setStatus(status);
      const res = await send();
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
    });

    it('takes a report in a paused mission', async () => {
      await setStatus('paused');
      expect((await send()).statusCode).toBe(201);
    });

    it('refuses a searcher who finished the activity', async () => {
      const finished = await signInSearcher(ctx);
      await addParticipant(ctx.db, {
        missionId: mission.id,
        callsign: 6,
        searcherId: finished.searcherId,
        status: 'ended',
      });
      const res = await send(body(), finished);
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('PARTICIPATION_ENDED');
    });

    it('saves an Available searcher report without a polygon', async () => {
      const free = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 7, searcherId: free.searcherId });
      const res = await send(body({ id: '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a88' }), free);
      expect(res.statusCode).toBe(201);
      expect(Report.parse(res.json()).polygonId).toBeNull();
    });

    it('records the report on the timeline at the time it was sent, and publishes it', async () => {
      const published: MissionEvent[] = [];
      const publish = ctx.realtime.publish.bind(ctx.realtime);
      ctx.realtime.publish = (event) => {
        published.push(event);
        publish(event);
      };
      await send();
      ctx.realtime.publish = publish;

      const recorded = published.find((e) => e.type === 'timeline.recorded');
      expect(recorded).toBeDefined();
      const event = TimelineEvent.parse(recorded && 'event' in recorded ? recorded.event : null);
      expect(event.type).toBe('report.submitted');
      expect(event.subject).toMatchObject({ kind: 'report', id: ID, label: 'מפגע, מדרון חלק' });
      expect(event.actor).toMatchObject({ kind: 'searcher', callsign: 4 });
      expect(Date.parse(event.occurredAt)).toBe(Date.parse('2026-10-03T13:20:00+03:00'));
    });
  });

  describe('the report photo', () => {
    beforeEach(async () => {
      await send();
    });
    const photoRows = () => ctx.db.select().from(reportPhotos);

    it('stores the photo and replaces it when sent again', async () => {
      const res = await putPhoto(JPEG);
      expect(res.statusCode).toBe(200);
      expect(Report.parse(res.json()).hasPhoto).toBe(true);
      expect(await photoRows()).toHaveLength(1);
      const again = await putPhoto(Buffer.concat([JPEG, Buffer.from([1, 2, 3])]));
      expect(again.statusCode).toBe(200);
      const stored = await photoRows();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.data.length).toBe(JPEG.length + 3);
    });

    it('hides the report from other searchers, refuses the commander and unknown ids', async () => {
      const other = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 5, searcherId: other.searcherId });
      expect((await putPhoto(JPEG, 'image/jpeg', other)).statusCode).toBe(404);
      expect((await putPhoto(JPEG, 'image/jpeg', commanderUser)).statusCode).toBe(403);
      expect((await putPhoto(JPEG, 'image/jpeg', user, '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9aff')).statusCode).toBe(404);
      expect(await photoRows()).toHaveLength(0);
    });

    it('answers 404 for a report id from another mission', async () => {
      const other = Mission.parse(
        (
          await commander({
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
      await addParticipant(ctx.db, { missionId: other.id, callsign: 1, searcherId: user.searcherId });
      expect((await putPhoto(JPEG, 'image/jpeg', user, ID, other.id)).statusCode).toBe(404);
    });

    it('refuses other content types, non-images and photos over the limit', async () => {
      const text = await putPhoto(Buffer.from('hello'), 'text/plain');
      expect(text.statusCode).toBe(415);
      const fake = await putPhoto(Buffer.from('not an image at all'), 'image/jpeg');
      expect(fake.statusCode).toBe(415);
      expect(ApiError.parse(fake.json()).error.code).toBe('UNSUPPORTED_PHOTO');
      const big = await putPhoto(Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES)]));
      expect(big.statusCode).toBe(413);
      expect(ApiError.parse(big.json()).error.code).toBe('PHOTO_TOO_LARGE');
      expect(await photoRows()).toHaveLength(0);
    });

    it('refuses a photo for an ended mission', async () => {
      await setStatus('ended_stopped');
      const res = await putPhoto(JPEG);
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
    });
  });
});
