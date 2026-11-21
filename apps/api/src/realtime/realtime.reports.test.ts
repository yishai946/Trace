import type { MissionEvent } from '@trace/schemas';
import { MissionPolygon, Report, ParticipantList } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { addParticipant, injectAs, PNG_BYTES, signInCommander, signInSearcher, type TestUser } from '../testing';
import { setupRealtime } from './fixtures';

describe('realtime', () => {
  const rt = setupRealtime();
  const { socketFor, connect, join, record, settle, createMissionAs, createPolygonAs } = rt;

  describe('reports', () => {
    const REPORT_ID = '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0e';
    const report = {
      id: REPORT_ID,
      type: 'hazard',
      text: 'מדרון חלק',
      position: { type: 'Point', coordinates: [35.131, 31.775] },
      reportedAt: '2026-10-03T13:20:00+03:00',
    };

    const areaB = {
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
    };

    const setup = async () => {
      const commander = await signInCommander(rt.ctx);
      const reporter = await signInSearcher(rt.ctx);
      const mate = await signInSearcher(rt.ctx);
      const other = await signInSearcher(rt.ctx);
      const idle = await signInSearcher(rt.ctx);
      const mission = await createMissionAs(commander);
      const polygonA = await createPolygonAs(commander, mission.id);
      const polygonB = MissionPolygon.parse(
        (
          await injectAs(
            rt.ctx,
            commander,
          )({ method: 'POST', url: `/api/missions/${mission.id}/polygons`, payload: { geometry: areaB } })
        ).json(),
      );
      await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 1,
        searcherId: reporter.searcherId,
        polygonId: polygonA.id,
      });
      const mateParticipationId = await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 2,
        searcherId: mate.searcherId,
        polygonId: polygonA.id,
      });
      await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 3,
        searcherId: other.searcherId,
        polygonId: polygonB.id,
      });
      await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 4, searcherId: idle.searcherId });
      const sockets = [socketFor(commander), socketFor(reporter), socketFor(mate), socketFor(other), socketFor(idle)];
      await Promise.all(sockets.map(connect));
      for (const socket of sockets) expect(await join(socket, mission.id)).toEqual({ ok: true });
      const [toCommander, toReporter, toMate, toOther, toIdle] = sockets.map(record) as [
        MissionEvent[],
        MissionEvent[],
        MissionEvent[],
        MissionEvent[],
        MissionEvent[],
      ];
      return {
        commander,
        reporter,
        other,
        idle,
        mission,
        polygonA,
        polygonB,
        mateParticipationId,
        toCommander,
        toReporter,
        toMate,
        toOther,
        toIdle,
      };
    };
    const reportEvents = (events: MissionEvent[]) => events.filter((e) => e.type.startsWith('report.'));
    const sendReport = (user: TestUser, missionId: string, payload: object = report) =>
      injectAs(rt.ctx, user)({ method: 'POST', url: `/api/missions/${missionId}/reports`, payload });

    it('R1: a new report goes to the commander, the author and the polygon’s searchers only, once per id', async () => {
      const { reporter, mission, toCommander, toReporter, toMate, toOther, toIdle } = await setup();
      const first = await sendReport(reporter, mission.id);
      expect(first.statusCode).toBe(201);
      await settle();
      const saved = { type: 'report.saved', missionId: mission.id, report: Report.parse(first.json()) };
      expect(reportEvents(toCommander)).toEqual([saved]);
      expect(reportEvents(toReporter)).toEqual([saved]);
      expect(reportEvents(toMate)).toEqual([saved]);
      expect(toCommander.some((e) => e.type === 'timeline.recorded')).toBe(true);
      expect(toMate.some((e) => e.type === 'timeline.recorded')).toBe(false);
      expect(reportEvents(toOther)).toEqual([]);
      expect(reportEvents(toIdle)).toEqual([]);

      expect((await sendReport(reporter, mission.id)).statusCode).toBe(200);
      await settle();
      expect(reportEvents(toCommander)).toHaveLength(1);
      expect(reportEvents(toMate)).toHaveLength(1);
    });

    it('R2: handling and editing reach the same audience, a refused handling nothing', async () => {
      const { commander, reporter, mission, toCommander, toReporter, toMate, toOther, toIdle } = await setup();
      await sendReport(reporter, mission.id);
      await settle();
      for (const events of [toCommander, toReporter, toMate]) events.length = 0;

      const refused = await injectAs(
        rt.ctx,
        reporter,
      )({ method: 'POST', url: `/api/missions/${mission.id}/reports/${REPORT_ID}/handle` });
      expect(refused.statusCode).toBe(403);
      await settle();
      expect(reportEvents(toCommander)).toEqual([]);
      expect(reportEvents(toMate)).toEqual([]);

      const handled = await injectAs(
        rt.ctx,
        commander,
      )({ method: 'POST', url: `/api/missions/${mission.id}/reports/${REPORT_ID}/handle` });
      expect(handled.statusCode).toBe(200);
      const edited = await injectAs(
        rt.ctx,
        reporter,
      )({ method: 'PATCH', url: `/api/missions/${mission.id}/reports/${REPORT_ID}`, payload: { text: 'עודכן' } });
      expect(edited.statusCode).toBe(200);
      await settle();
      const expected = [
        { type: 'report.saved', missionId: mission.id, report: Report.parse(handled.json()) },
        { type: 'report.saved', missionId: mission.id, report: Report.parse(edited.json()) },
      ];
      expect(reportEvents(toCommander)).toEqual(expected);
      expect(reportEvents(toReporter)).toEqual(expected);
      expect(reportEvents(toMate)).toEqual(expected);
      expect(reportEvents(toOther)).toEqual([]);
      expect(reportEvents(toIdle)).toEqual([]);
    });

    it('R3: deletion reaches the commander, the author and the polygon’s searchers', async () => {
      const { commander, reporter, mission, toCommander, toReporter, toMate, toOther, toIdle } = await setup();
      await sendReport(reporter, mission.id);
      await settle();
      for (const events of [toCommander, toReporter, toMate]) events.length = 0;
      const deleted = await injectAs(
        rt.ctx,
        commander,
      )({ method: 'DELETE', url: `/api/missions/${mission.id}/reports/${REPORT_ID}` });
      expect(deleted.statusCode).toBe(204);
      await settle();
      const event = { type: 'report.deleted', missionId: mission.id, reportId: REPORT_ID };
      expect(reportEvents(toCommander)).toEqual([event]);
      expect(reportEvents(toReporter)).toEqual([event]);
      expect(reportEvents(toMate)).toEqual([event]);
      expect(reportEvents(toOther)).toEqual([]);
      expect(reportEvents(toIdle)).toEqual([]);
    });

    it('R4: a report with no polygon goes to the commander and the author only', async () => {
      const { idle, mission, toCommander, toReporter, toMate, toIdle } = await setup();
      expect((await sendReport(idle, mission.id)).statusCode).toBe(201);
      await settle();
      expect(reportEvents(toCommander)).toHaveLength(1);
      expect(reportEvents(toIdle)).toHaveLength(1);
      expect(reportEvents(toReporter)).toEqual([]);
      expect(reportEvents(toMate)).toEqual([]);
    });

    it('R5: a searcher moved to another polygon no longer gets the old polygon’s events', async () => {
      const { commander, reporter, mission, polygonB, mateParticipationId, toCommander, toReporter, toMate } =
        await setup();
      const moved = await injectAs(
        rt.ctx,
        commander,
      )({
        method: 'PUT',
        url: `/api/missions/${mission.id}/participants/${mateParticipationId}/assignment`,
        payload: { polygonId: polygonB.id },
      });
      expect(moved.statusCode).toBe(200);
      await settle();
      for (const events of [toCommander, toReporter, toMate]) events.length = 0;

      expect((await sendReport(reporter, mission.id)).statusCode).toBe(201);
      await settle();
      expect(reportEvents(toCommander)).toHaveLength(1);
      expect(reportEvents(toReporter)).toHaveLength(1);
      expect(reportEvents(toMate)).toEqual([]);
    });

    it('R6: a searcher moved to another polygon gets the new polygon’s events', async () => {
      const { commander, other, mission, polygonB, mateParticipationId, toMate, toOther } = await setup();
      await injectAs(
        rt.ctx,
        commander,
      )({
        method: 'PUT',
        url: `/api/missions/${mission.id}/participants/${mateParticipationId}/assignment`,
        payload: { polygonId: polygonB.id },
      });
      await settle();
      toMate.length = 0;
      expect((await sendReport(other, mission.id)).statusCode).toBe(201);
      await settle();
      expect(reportEvents(toMate)).toHaveLength(1);
      expect(reportEvents(toOther)).toHaveLength(1);
    });

    it('R8: an edit reaches the author after the author moved to another polygon', async () => {
      const { commander, reporter, mission, polygonB, toReporter } = await setup();
      await sendReport(reporter, mission.id);
      const participants = ParticipantList.parse(
        (await injectAs(rt.ctx, commander)({ method: 'GET', url: `/api/missions/${mission.id}/participants` })).json(),
      );
      const author = participants.find((p) => p.callsign === 1);
      await injectAs(
        rt.ctx,
        commander,
      )({
        method: 'PUT',
        url: `/api/missions/${mission.id}/participants/${author?.id}/assignment`,
        payload: { polygonId: polygonB.id },
      });
      await settle();
      toReporter.length = 0;
      const edited = await injectAs(
        rt.ctx,
        commander,
      )({ method: 'PATCH', url: `/api/missions/${mission.id}/reports/${REPORT_ID}`, payload: { text: 'עודכן' } });
      expect(edited.statusCode).toBe(200);
      await settle();
      expect(reportEvents(toReporter)).toHaveLength(1);
    });

    it('R7: a photo upload goes to the same audience', async () => {
      const { reporter, mission, toCommander, toReporter, toMate, toOther, toIdle } = await setup();
      await sendReport(reporter, mission.id);
      await settle();
      for (const events of [toCommander, toReporter, toMate]) events.length = 0;
      const res = await injectAs(
        rt.ctx,
        reporter,
      )({
        method: 'PUT',
        url: `/api/missions/${mission.id}/reports/${REPORT_ID}/photo`,
        payload: PNG_BYTES,
        headers: { 'content-type': 'image/png' },
      });
      expect(res.statusCode).toBe(200);
      await settle();
      for (const events of [toCommander, toReporter, toMate]) expect(reportEvents(events)).toHaveLength(1);
      expect(reportEvents(toOther)).toEqual([]);
      expect(reportEvents(toIdle)).toEqual([]);
    });
  });
});
