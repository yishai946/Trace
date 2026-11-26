import { ApiError, Report } from '@trace/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { reportPhotos } from '../../db/schema';
import { reportPhotoKey } from '../../storage';
import { addParticipant, signInCommander, signInSearcher } from '../../testing';
import { ID, JPEG, body, setupReports } from './fixtures';

describe('field reports (UC-F09)', () => {
  const rt = setupReports();
  const {
    send,
    putPhoto,
    rows,
    ID2,
    MISSING,
    list,
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
  } = rt;

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
        for (const as of [rt.user, await otherSearcher()]) {
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
      expect((await handle(rt.commanderUser, MISSING)).statusCode).toBe(404);
      const other = await createOtherMission();
      await addParticipant(rt.ctx.db, { missionId: other.id, callsign: 1, searcherId: rt.user.searcherId });
      await send(body({ id: ID2 }), rt.user, other.id);
      expect((await handle(rt.commanderUser, ID2)).statusCode).toBe(404);
      expect((await handle(await signInCommander(rt.ctx))).statusCode).toBe(404);
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
        const res = await patch({ text: '  מדרון חלק מאוד ' }, rt.user);
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

    const joinPolygon = async (callsign: number, polygonId: string) => {
      const as = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, { missionId: rt.mission.id, callsign, searcherId: as.searcherId, polygonId });
      return as;
    };

    it('refuses a searcher of the report’s polygon who is not its author', async () => {
      const res = await patch({ text: 'פולש' }, await joinPolygon(5, rt.polygon.id));
      expect(res.statusCode).toBe(403);
      expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
      expect((await rows())[0]?.text).toBe('מדרון חלק');
    });

    it('answers 404 to a searcher who may not see the report, so its existence is not revealed', async () => {
      const polygonB = await makePolygonB();
      for (const as of [await joinPolygon(6, polygonB.id), await otherSearcher(7), await signInSearcher(rt.ctx)]) {
        const res = await patch({ text: 'פולש' }, as);
        expect(res.statusCode).toBe(404);
        expect(ApiError.parse(res.json()).error.code).toBe('NOT_FOUND');
      }
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
      for (const as of [rt.commanderUser, rt.user]) {
        const res = await patch({ text: 'מאוחר' }, as);
        expect(res.statusCode).toBe(409);
        expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
      }
    });

    it('answers 404 for an unknown report and another mission’s report', async () => {
      expect((await patch({ text: 'x' }, rt.commanderUser, MISSING)).statusCode).toBe(404);
      const other = await createOtherMission();
      await addParticipant(rt.ctx.db, { missionId: other.id, callsign: 1, searcherId: rt.user.searcherId });
      await send(body({ id: ID2 }), rt.user, other.id);
      expect((await patch({ text: 'x' }, rt.commanderUser, ID2)).statusCode).toBe(404);
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
      for (const as of [rt.user, await otherSearcher()]) {
        const res = await del(as);
        expect(res.statusCode).toBe(403);
        expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
      }
      expect(await rows()).toHaveLength(1);
    });

    it('lets the commander delete the report with its photo and publishes it', async () => {
      await putPhoto(JPEG);
      const [photo] = await rt.ctx.db.select().from(reportPhotos);
      const key = reportPhotoKey(ID, photo?.updatedAt ?? new Date(0));
      expect(await rt.ctx.photos.get(key)).not.toBeNull();
      const events = await capture(async () => {
        expect((await del()).statusCode).toBe(204);
      });
      expect(await rows()).toHaveLength(0);
      expect(await rt.ctx.db.select().from(reportPhotos)).toHaveLength(0);
      expect(await rt.ctx.photos.get(key)).toBeNull();
      expect((await list()).json()).toEqual([]);
      expect(reportEvents(events)).toEqual([{ type: 'report.deleted', missionId: rt.mission.id, reportId: ID }]);
    });

    it('answers 404 for an unknown report and 409 once the mission has ended', async () => {
      expect((await del(rt.commanderUser, MISSING)).statusCode).toBe(404);
      await setStatus('ended_stopped');
      const res = await del();
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
      expect(await rows()).toHaveLength(1);
    });
  });
});
