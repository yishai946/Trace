import { isCriticalReport, MAX_PHOTO_BYTES, type MissionStatus } from '@trace/domain';
import {
  ApiError,
  Mission,
  MissionPolygon,
  Report,
  ReportList,
  TimelineEvent,
  type MissionEvent,
} from '@trace/schemas';
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
      expect(published.filter((e) => e.type === 'report.saved')).toHaveLength(1);
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

  describe('listing reports (UC-C11)', () => {
    it('lists the reports newest first with every detail', async () => {
      await send(body({ reportedAt: '2026-10-03T13:20:00+03:00' }));
      await send(body({ id: ID2, type: 'finding', text: 'כפפה', reportedAt: '2026-10-03T13:25:00+03:00' }));
      const res = await list();
      expect(res.statusCode).toBe(200);
      const reports = ReportList.parse(res.json());
      expect(reports.map((r) => r.id)).toEqual([ID2, ID]);
      expect(reports[1]).toMatchObject({
        type: 'hazard',
        text: 'מדרון חלק',
        position: { type: 'Point', coordinates: [35.131, 31.775] },
        accuracy: 7.5,
        reportedBy: { role: 'searcher', callsign: 4 },
        polygonId: polygon.id,
        status: 'new',
        hasPhoto: false,
        photoUrl: null,
      });
      expect(Date.parse(reports[1]?.reportedAt ?? '')).toBe(Date.parse('2026-10-03T13:20:00+03:00'));
    });

    it('lists nothing for a mission without reports', async () => {
      const res = await list();
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('is the commander’s: 403 for a searcher in the mission, 404 for outsiders, 401 without a session', async () => {
      const forbidden = await list(user);
      expect(forbidden.statusCode).toBe(403);
      expect(ApiError.parse(forbidden.json()).error.code).toBe('FORBIDDEN');
      expect((await list(await signInSearcher(ctx))).statusCode).toBe(404);
      expect((await list(await signInCommander(ctx))).statusCode).toBe(404);
      expect((await list(null)).statusCode).toBe(401);
    });

    it('does not list the reports of another mission', async () => {
      await send();
      const other = await createOtherMission();
      const res = await list(commanderUser, other.id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('still lists once the mission has ended', async () => {
      await send();
      await setStatus('ended_stopped');
      const res = await list();
      expect(res.statusCode).toBe(200);
      expect(ReportList.parse(res.json())).toHaveLength(1);
    });
  });

  describe('the report photo for the commander', () => {
    beforeEach(async () => {
      await send();
    });

    it('serves the photo at the address in the report, cached by its version', async () => {
      const saved = Report.parse((await putPhoto(JPEG)).json());
      expect(saved.hasPhoto).toBe(true);
      expect(saved.photoUrl).toMatch(new RegExp(`^/api/missions/${mission.id}/reports/${ID}/photo\\?v=\\d+$`));
      const res = await getPhoto(commanderUser, saved.photoUrl ?? '');
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.equals(JPEG)).toBe(true);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, max-age=31536000, immutable');
      const unversioned = await getPhoto();
      expect(unversioned.statusCode).toBe(200);
      expect(unversioned.headers['cache-control']).toBe('private, no-cache');
    });

    it('lets the author read it and hides it from other searchers and outsiders', async () => {
      await putPhoto(JPEG);
      expect((await getPhoto(user)).statusCode).toBe(200);
      expect((await getPhoto(await otherSearcher())).statusCode).toBe(404);
      expect((await getPhoto(await signInSearcher(ctx))).statusCode).toBe(404);
    });

    it('answers 404 without a photo and for an unknown report', async () => {
      expect((await getPhoto()).statusCode).toBe(404);
      await putPhoto(JPEG);
      expect((await getPhoto(commanderUser, `${reportUrl(MISSING)}/photo`)).statusCode).toBe(404);
    });

    it('changes the address when the photo is replaced', async () => {
      const first = Report.parse((await putPhoto(JPEG)).json());
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = Report.parse((await putPhoto(Buffer.concat([JPEG, Buffer.from([1])]))).json());
      expect(second.photoUrl).not.toBe(first.photoUrl);
    });

    it('publishes the report with its photo', async () => {
      const events = await capture(() => putPhoto(JPEG));
      const saved = reportEvents(events);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        type: 'report.saved',
        missionId: mission.id,
        report: { id: ID, hasPhoto: true },
      });
    });
  });

  describe('marking Handled (UC-C11, decision 17)', () => {
    beforeEach(async () => {
      await send();
    });

    it('lets the commander mark a report Handled and publishes it once', async () => {
      const events = await capture(async () => {
        const res = await handle();
        expect(res.statusCode).toBe(200);
        expect(Report.parse(res.json()).status).toBe('handled');
      });
      expect(await rowStatus()).toBe('handled');
      const saved = reportEvents(events);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ type: 'report.saved', report: { id: ID, status: 'handled' } });
    });

    it('refuses searchers, the author included', async () => {
      const events = await capture(async () => {
        for (const as of [user, await otherSearcher()]) {
          const res = await handle(as);
          expect(res.statusCode).toBe(403);
          expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
        }
      });
      expect(await rowStatus()).toBe('new');
      expect(reportEvents(events)).toEqual([]);
    });

    it('answers a second time unchanged and publishes nothing', async () => {
      const first = await handle();
      const events = await capture(async () => {
        const again = await handle();
        expect(again.statusCode).toBe(200);
        expect(again.json()).toEqual(first.json());
      });
      expect(reportEvents(events)).toEqual([]);
    });

    it('answers 404 for an unknown report, another mission’s report and another commander', async () => {
      expect((await handle(commanderUser, MISSING)).statusCode).toBe(404);
      const other = await createOtherMission();
      await addParticipant(ctx.db, { missionId: other.id, callsign: 1, searcherId: user.searcherId });
      await send(body({ id: ID2 }), user, other.id);
      expect((await handle(commanderUser, ID2)).statusCode).toBe(404);
      expect((await handle(await signInCommander(ctx))).statusCode).toBe(404);
      expect(await rowStatus()).toBe('new');
    });

    it('refuses an ended mission', async () => {
      await setStatus('ended_stopped');
      const res = await handle();
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
      expect(await rowStatus()).toBe('new');
    });
  });

  describe('editing (decision 88)', () => {
    beforeEach(async () => {
      await send();
    });

    it('lets the author edit the text, trimmed, without a second row', async () => {
      const events = await capture(async () => {
        const res = await patch({ text: '  מדרון חלק מאוד ' }, user);
        expect(res.statusCode).toBe(200);
        expect(Report.parse(res.json())).toMatchObject({ text: 'מדרון חלק מאוד', type: 'hazard' });
      });
      expect(await rows()).toHaveLength(1);
      expect(reportEvents(events)).toMatchObject([
        { type: 'report.saved', report: { id: ID, text: 'מדרון חלק מאוד' } },
      ]);
    });

    it('lets the commander edit the type and the text', async () => {
      const res = await patch({ type: 'general', text: 'עדכון' });
      expect(res.statusCode).toBe(200);
      expect(Report.parse(res.json())).toMatchObject({ type: 'general', text: 'עדכון' });
    });

    it('refuses another searcher in the mission and hides the report from outsiders', async () => {
      const other = await otherSearcher();
      const res = await patch({ text: 'פולש' }, other);
      expect(res.statusCode).toBe(403);
      expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
      expect((await patch({ text: 'פולש' }, await signInSearcher(ctx))).statusCode).toBe(404);
      expect((await rows())[0]?.text).toBe('מדרון חלק');
    });

    it('refuses an empty body, blank or too long text and an unknown type', async () => {
      for (const payload of [{}, { text: '   ' }, { text: 'א'.repeat(2001) }, { type: 'rumor' }]) {
        const res = await patch(payload);
        expect(res.statusCode).toBe(400);
        expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('refuses an ended mission for the commander and the author', async () => {
      await setStatus('ended_stopped');
      for (const as of [commanderUser, user]) {
        const res = await patch({ text: 'מאוחר' }, as);
        expect(res.statusCode).toBe(409);
        expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
      }
    });

    it('answers 404 for an unknown report and another mission’s report', async () => {
      expect((await patch({ text: 'x' }, commanderUser, MISSING)).statusCode).toBe(404);
      const other = await createOtherMission();
      await addParticipant(ctx.db, { missionId: other.id, callsign: 1, searcherId: user.searcherId });
      await send(body({ id: ID2 }), user, other.id);
      expect((await patch({ text: 'x' }, commanderUser, ID2)).statusCode).toBe(404);
    });

    it('keeps a handled report handled', async () => {
      await handle();
      const res = await patch({ text: 'עדכון' });
      expect(Report.parse(res.json()).status).toBe('handled');
    });
  });

  describe('deleting (decision 89)', () => {
    beforeEach(async () => {
      await send();
    });

    it('refuses searchers, the author included', async () => {
      for (const as of [user, await otherSearcher()]) {
        const res = await del(as);
        expect(res.statusCode).toBe(403);
        expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
      }
      expect(await rows()).toHaveLength(1);
    });

    it('lets the commander delete the report with its photo and publishes it', async () => {
      await putPhoto(JPEG);
      const events = await capture(async () => {
        expect((await del()).statusCode).toBe(204);
      });
      expect(await rows()).toHaveLength(0);
      expect(await ctx.db.select().from(reportPhotos)).toHaveLength(0);
      expect((await list()).json()).toEqual([]);
      expect(reportEvents(events)).toEqual([{ type: 'report.deleted', missionId: mission.id, reportId: ID }]);
    });

    it('answers 404 for an unknown report and 409 once the mission has ended', async () => {
      expect((await del(commanderUser, MISSING)).statusCode).toBe(404);
      await setStatus('ended_stopped');
      const res = await del();
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
      expect(await rows()).toHaveLength(1);
    });
  });

  describe('a "located" report (decision 18)', () => {
    const sendLocated = () => send(body({ type: 'located', text: 'הנעדר אותר' }));
    const missionOf = async () =>
      Mission.parse((await asCommander({ method: 'GET', url: `/api/missions/${mission.id}` })).json());

    it('is a critical report for the commander and leaves the mission Active', async () => {
      const events = await capture(async () => {
        expect((await sendLocated()).statusCode).toBe(201);
      });
      const saved = reportEvents(events);
      expect(saved).toHaveLength(1);
      const report = saved[0] && 'report' in saved[0] ? saved[0].report : null;
      expect(report).toMatchObject({ type: 'located', status: 'new' });
      expect(report && isCriticalReport(report)).toBe(true);
      expect((await missionOf()).status).toBe('active');
      expect((await ctx.db.select().from(missions))[0]?.status).toBe('active');
    });

    it('leaves a paused mission paused', async () => {
      await setStatus('paused');
      await sendLocated();
      expect((await missionOf()).status).toBe('paused');
    });

    it('stops being critical once the commander marks it Handled, and the mission stays Active', async () => {
      await sendLocated();
      const events = await capture(() => handle());
      const saved = reportEvents(events)[0];
      const report = saved && 'report' in saved ? saved.report : null;
      expect(report && isCriticalReport(report)).toBe(false);
      expect((await missionOf()).status).toBe('active');
    });
  });
});
