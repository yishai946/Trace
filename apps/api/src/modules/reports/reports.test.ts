import { isCriticalReport, MAX_PHOTO_BYTES } from '@trace/domain';
import { ApiError, Mission, Report, TimelineEvent, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, reportPhotos, timelineEvents } from '../../db/schema';
import { addParticipant, signInSearcher } from '../../testing';
import { ID, JPEG, body, setupReports } from './fixtures';

describe('field reports (UC-F09)', () => {
  const rt = setupReports();
  const { send, putPhoto, rows, asCommander, handle, capture, reportEvents, setStatus } = rt;

  describe('sending a report', () => {
    it('saves a valid report as New with its location and the searcher polygon', async () => {
      const res = await send();
      expect(res.statusCode).toBe(201);
      const report = Report.parse(res.json());
      expect(report).toMatchObject({
        id: ID,
        missionId: rt.mission.id,
        polygonId: rt.polygon.id,
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
      const publish = rt.ctx.realtime.publish.bind(rt.ctx.realtime);
      rt.ctx.realtime.publish = (event) => {
        published.push(event);
        publish(event);
      };
      const first = await send();
      const second = await send();
      rt.ctx.realtime.publish = publish;

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual(first.json());
      expect(await rows()).toHaveLength(1);
      const events = await rt.ctx.db.select().from(timelineEvents).where(eq(timelineEvents.type, 'report.submitted'));
      expect(events).toHaveLength(1);
      expect(published.filter((e) => e.type === 'timeline.recorded')).toHaveLength(1);
      expect(published.filter((e) => e.type === 'report.saved')).toHaveLength(1);
    });

    it('refuses an id that belongs to another searcher, leaving the original', async () => {
      await send();
      const other = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, { missionId: rt.mission.id, callsign: 5, searcherId: other.searcherId });
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
      const outsider = await signInSearcher(rt.ctx);
      expect((await send(body(), outsider)).statusCode).toBe(404);
      expect((await send(body(), rt.commanderUser)).statusCode).toBe(403);
      expect((await send(body(), null)).statusCode).toBe(401);
    });

    it.each(['ended_located', 'ended_stopped'] as const)('refuses a mission that is %s', async (status) => {
      await setStatus(status);
      const res = await send();
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
    });

    it('answers 200 with the saved report when a report sent before the mission ended is sent again', async () => {
      const first = await send();
      await setStatus('ended_stopped');
      const again = await send();
      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual(first.json());
      expect(await rows()).toHaveLength(1);
    });

    it('answers 200 with the saved report when the searcher finished the activity after sending it', async () => {
      const first = await send();
      await rt.ctx.db
        .update(participations)
        .set({ status: 'ended' })
        .where(eq(participations.missionId, rt.mission.id));
      const again = await send();
      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual(first.json());
    });

    it('takes a report in a paused mission', async () => {
      await setStatus('paused');
      expect((await send()).statusCode).toBe(201);
    });

    it('refuses a searcher who finished the activity', async () => {
      const finished = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, {
        missionId: rt.mission.id,
        callsign: 6,
        searcherId: finished.searcherId,
        status: 'ended',
      });
      const res = await send(body(), finished);
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('PARTICIPATION_ENDED');
    });

    it('saves an Available searcher report without a polygon', async () => {
      const free = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, { missionId: rt.mission.id, callsign: 7, searcherId: free.searcherId });
      const res = await send(body({ id: '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a88' }), free);
      expect(res.statusCode).toBe(201);
      expect(Report.parse(res.json()).polygonId).toBeNull();
    });

    it('records the report on the timeline at the time it was sent, and publishes it', async () => {
      const published: MissionEvent[] = [];
      const publish = rt.ctx.realtime.publish.bind(rt.ctx.realtime);
      rt.ctx.realtime.publish = (event) => {
        published.push(event);
        publish(event);
      };
      await send();
      rt.ctx.realtime.publish = publish;

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
    const photoRows = () => rt.ctx.db.select().from(reportPhotos);

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
      const other = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, { missionId: rt.mission.id, callsign: 5, searcherId: other.searcherId });
      expect((await putPhoto(JPEG, 'image/jpeg', other)).statusCode).toBe(404);
      expect((await putPhoto(JPEG, 'image/jpeg', rt.commanderUser)).statusCode).toBe(403);
      expect((await putPhoto(JPEG, 'image/jpeg', rt.user, '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9aff')).statusCode).toBe(
        404,
      );
      expect(await photoRows()).toHaveLength(0);
    });

    it('answers 404 for a report id from another mission', async () => {
      const other = Mission.parse(
        (
          await rt.commander({
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
      await addParticipant(rt.ctx.db, { missionId: other.id, callsign: 1, searcherId: rt.user.searcherId });
      expect((await putPhoto(JPEG, 'image/jpeg', rt.user, ID, other.id)).statusCode).toBe(404);
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

  describe('a "located" report (decision 18)', () => {
    const sendLocated = () => send(body({ type: 'located', text: 'הנעדר אותר' }));
    const missionOf = async () =>
      Mission.parse((await asCommander({ method: 'GET', url: `/api/missions/${rt.mission.id}` })).json());

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
      expect((await rt.ctx.db.select().from(missions))[0]?.status).toBe('active');
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
