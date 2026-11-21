import type { MissionPolygon } from '@trace/schemas';
import { ApiError, Report, ReportList } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { participations } from '../../db/schema';
import { addParticipant, signInCommander, signInSearcher, type TestUser } from '../../testing';
import { ID, JPEG, body, setupReports } from './fixtures';

describe('field reports (UC-F09)', () => {
  const rt = setupReports();
  const {
    send,
    putPhoto,
    ID2,
    MISSING,
    reportUrl,
    list,
    getPhoto,
    handle,
    patch,
    capture,
    reportEvents,
    otherSearcher,
    createOtherMission,
    makePolygonB,
    setStatus,
  } = rt;

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
        polygonId: rt.polygon.id,
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

    it('answers 404 to outsiders and other commanders, and 401 without a session', async () => {
      expect((await list(await signInSearcher(rt.ctx))).statusCode).toBe(404);
      expect((await list(await signInCommander(rt.ctx))).statusCode).toBe(404);
      expect((await list(null)).statusCode).toBe(401);
    });

    it('does not list the reports of another mission', async () => {
      await send();
      const other = await createOtherMission();
      const res = await list(rt.commanderUser, other.id);
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

  describe('reports in the polygon (UC-F11, decision 80)', () => {
    const IDS = {
      mine: '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9b01',
      mate: '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9b02',
      far: '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9b03',
    };
    let polygonB: MissionPolygon;
    let mate: TestUser & { searcherId: string };
    let far: TestUser & { searcherId: string };
    let mateParticipationId: string;
    const join = async (callsign: number, polygonId?: string) => {
      const as = await signInSearcher(rt.ctx);
      const participationId = await addParticipant(rt.ctx.db, {
        missionId: rt.mission.id,
        callsign,
        searcherId: as.searcherId,
        polygonId,
      });
      return { as, participationId };
    };
    const ids = (res: { json: () => unknown }) => ReportList.parse(res.json()).map((r) => r.id);
    const move = (participantId: string, polygonId: string) =>
      rt.commander({
        method: 'PUT',
        url: `/api/missions/${rt.mission.id}/participants/${participantId}/assignment`,
        payload: { polygonId },
      });

    beforeEach(async () => {
      polygonB = await makePolygonB();
      const m = await join(5, rt.polygon.id);
      mate = m.as;
      mateParticipationId = m.participationId;
      far = (await join(6, polygonB.id)).as;
    });

    const sendAll = async () => {
      expect((await send(body({ id: IDS.mine, reportedAt: '2026-10-03T13:20:00+03:00' }), rt.user)).statusCode).toBe(
        201,
      );
      expect((await send(body({ id: IDS.mate, reportedAt: '2026-10-03T13:30:00+03:00' }), mate)).statusCode).toBe(201);
      expect((await send(body({ id: IDS.far, reportedAt: '2026-10-03T13:40:00+03:00' }), far)).statusCode).toBe(201);
    };

    it('lists the polygon’s reports and the searcher’s own, not another polygon’s', async () => {
      await sendAll();
      const res = await list(rt.user);
      expect(res.statusCode).toBe(200);
      expect(ids(res)).toEqual([IDS.mate, IDS.mine]);
    });

    it('shows the author’s name and callsign to a searcher of the polygon', async () => {
      await sendAll();
      const mateReport = ReportList.parse((await list(rt.user)).json()).find((r) => r.id === IDS.mate);
      expect(mateReport?.reportedBy).toMatchObject({ role: 'searcher', callsign: 5 });
      expect(mateReport?.reportedBy.name).toEqual(expect.any(String));
    });

    it('gives the commander every report', async () => {
      await sendAll();
      expect(ids(await list(rt.commanderUser))).toEqual([IDS.far, IDS.mate, IDS.mine]);
    });

    it('keeps the own reports from the old polygon and shows the new polygon’s after a move', async () => {
      await sendAll();
      expect(ids(await list(rt.user))).toEqual([IDS.mate, IDS.mine]);
      expect((await move(await participationOf(rt.user), polygonB.id)).statusCode).toBe(200);
      expect(ids(await list(rt.user))).toEqual([IDS.far, IDS.mine]);
    });

    it('lists the old polygon’s reports for a searcher moved into it', async () => {
      await sendAll();
      expect((await move(mateParticipationId, polygonB.id)).statusCode).toBe(200);
      expect(ids(await list(mate))).toEqual([IDS.far, IDS.mate]);
    });

    const participationOf = async (as: TestUser & { searcherId: string }) => {
      const [row] = await rt.ctx.db.select().from(participations).where(eq(participations.searcherId, as.searcherId));
      if (!row) throw new Error('no participation');
      return row.id;
    };

    it('shows an Available searcher only their own reports', async () => {
      await sendAll();
      await rt.ctx.db
        .update(participations)
        .set({ status: 'available', polygonId: null, taskStatus: null })
        .where(eq(participations.searcherId, rt.user.searcherId));
      expect(ids(await list(rt.user))).toEqual([IDS.mine]);
      const idle = (await join(8)).as;
      expect(ids(await list(idle))).toEqual([]);
    });

    it('shows a report sent while Available only to its author and the commander', async () => {
      const idle = (await join(8)).as;
      expect((await send(body({ id: IDS.far }), idle)).statusCode).toBe(201);
      expect(ids(await list(idle))).toEqual([IDS.far]);
      expect(ids(await list(rt.user))).toEqual([]);
      expect(ids(await list(rt.commanderUser))).toEqual([IDS.far]);
    });

    it('shows a searcher who finished only their own reports', async () => {
      await sendAll();
      await rt.ctx.db
        .update(participations)
        .set({ status: 'ended' })
        .where(eq(participations.searcherId, rt.user.searcherId));
      expect(ids(await list(rt.user))).toEqual([IDS.mine]);
    });

    it('answers 200 with an empty list for a polygon without reports', async () => {
      const res = await list(rt.user);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('never lists the reports of another mission', async () => {
      await sendAll();
      const other = await createOtherMission();
      await addParticipant(rt.ctx.db, {
        missionId: other.id,
        callsign: 4,
        searcherId: rt.user.searcherId,
        polygonId: undefined,
      });
      expect(ids(await list(rt.user, other.id))).toEqual([]);
    });

    it('lists in a paused and in an ended mission, and an ended mission takes no new report', async () => {
      await sendAll();
      await setStatus('paused');
      expect(ids(await list(rt.user))).toEqual([IDS.mate, IDS.mine]);
      await setStatus('ended_stopped');
      expect(ids(await list(rt.user))).toEqual([IDS.mate, IDS.mine]);
      expect((await send(body({ id: ID2 }), rt.user)).statusCode).toBe(409);
    });

    it('shows a searcher of the polygon the report after it was handled or edited', async () => {
      await sendAll();
      await handle(rt.commanderUser, IDS.mate, rt.mission.id);
      await patch({ text: 'עודכן' }, rt.commanderUser, IDS.mate);
      const updated = ReportList.parse((await list(rt.user)).json()).find((r) => r.id === IDS.mate);
      expect(updated).toMatchObject({ status: 'handled', text: 'עודכן' });
    });

    it('answers 404 to an outsider, 404 to another commander and 401 without a session', async () => {
      expect((await list(await signInSearcher(rt.ctx))).statusCode).toBe(404);
      expect((await list(await signInCommander(rt.ctx))).statusCode).toBe(404);
      expect((await list(null)).statusCode).toBe(401);
    });
  });

  describe('the report photo for the commander', () => {
    beforeEach(async () => {
      await send();
    });

    it('serves the photo at the address in the report, cached by its version', async () => {
      const saved = Report.parse((await putPhoto(JPEG)).json());
      expect(saved.hasPhoto).toBe(true);
      expect(saved.photoUrl).toMatch(new RegExp(`^/api/missions/${rt.mission.id}/reports/${ID}/photo\\?v=\\d+$`));
      const res = await getPhoto(rt.commanderUser, saved.photoUrl ?? '');
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.equals(JPEG)).toBe(true);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, max-age=31536000, immutable');
      const unversioned = await getPhoto();
      expect(unversioned.statusCode).toBe(200);
      expect(unversioned.headers['cache-control']).toBe('private, no-cache');
    });

    it('lets the author read it and hides it from Available searchers and outsiders', async () => {
      await putPhoto(JPEG);
      expect((await getPhoto(rt.user)).statusCode).toBe(200);
      expect((await getPhoto(await otherSearcher())).statusCode).toBe(404);
      expect((await getPhoto(await signInSearcher(rt.ctx))).statusCode).toBe(404);
    });

    it('serves it to a searcher in the report’s polygon and hides it from another polygon (decision 80)', async () => {
      await putPhoto(JPEG);
      const mate = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, {
        missionId: rt.mission.id,
        callsign: 6,
        searcherId: mate.searcherId,
        polygonId: rt.polygon.id,
      });
      expect((await getPhoto(mate)).statusCode).toBe(200);
      const elsewhere = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, {
        missionId: rt.mission.id,
        callsign: 7,
        searcherId: elsewhere.searcherId,
        polygonId: (await makePolygonB()).id,
      });
      const res = await getPhoto(elsewhere);
      expect(res.statusCode).toBe(404);
      expect(ApiError.parse(res.json()).error.code).toBe('NOT_FOUND');
    });

    it('answers 404 without a photo and for an unknown report', async () => {
      expect((await getPhoto()).statusCode).toBe(404);
      await putPhoto(JPEG);
      expect((await getPhoto(rt.commanderUser, `${reportUrl(MISSING)}/photo`)).statusCode).toBe(404);
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
        missionId: rt.mission.id,
        report: { id: ID, hasPhoto: true },
      });
    });
  });
});
