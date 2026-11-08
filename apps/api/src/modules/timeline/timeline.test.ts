import { TIMELINE_EVENT_TYPES, type TimelineEventType } from '@trace/domain';
import { ApiError, Mission, MissionPolygon, TimelineEventList, type TimelineEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Polygon } from 'geojson';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, timelineEvents } from '../../db/schema';
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
import { recordEvent, type RecordEventInput } from './timeline.service';

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
const AREA = box(35.122, 31.77, 35.136, 31.781);
const SMALLER = box(35.122, 31.77, 35.126, 31.774);
const INSIDE_ONLY_AREA: [number, number] = [35.13, 31.778];
const LKP_TIME = '2026-10-03T13:05:00+03:00';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('timeline', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    missionId = await createMission('מסע 0412');
  });

  async function createMission(name: string, as: ReturnType<typeof injectAs> = inject) {
    const res = await as({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name,
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: LKP_TIME },
      },
    });
    expect(res.statusCode).toBe(201);
    return Mission.parse(res.json()).id;
  }

  const timelineOf = async (id = missionId): Promise<TimelineEvent[]> => {
    const res = await inject({ method: 'GET', url: `/api/missions/${id}/timeline` });
    expect(res.statusCode).toBe(200);
    return TimelineEventList.parse(res.json());
  };
  const typesOf = async (id = missionId) => (await timelineOf(id)).map((e) => e.type);
  const polygonUrl = (polygonId?: string) => `/api/missions/${missionId}/polygons${polygonId ? `/${polygonId}` : ''}`;
  const draw = async (name?: string) => {
    const res = await inject({ method: 'POST', url: polygonUrl(), payload: { geometry: AREA, name } });
    expect(res.statusCode).toBe(201);
    return MissionPolygon.parse(res.json());
  };
  const patch = (polygonId: string, payload: object) =>
    inject({ method: 'PATCH', url: polygonUrl(polygonId), payload });
  const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

  describe('recording', () => {
    it('records the creation of a mission and its first LKP, in that order', async () => {
      const events = await timelineOf();
      expect(events.map((e) => e.type)).toEqual(['mission.created', 'lkp.changed']);
      const [created, lkp] = events;
      expect(created).toMatchObject({
        actor: { kind: 'commander', userId: commander.userId, name: 'מנהל' },
        subject: { kind: 'mission', id: missionId, label: 'מסע 0412' },
      });
      expect(lkp).toMatchObject({
        actor: { kind: 'commander', userId: commander.userId },
        subject: { kind: 'lkp', label: null },
        details: { observedAt: new Date(LKP_TIME).toISOString(), previousObservedAt: null },
      });
      // Same transaction, same instant: the recording order keeps them in sequence.
      expect(created?.occurredAt).toBe(lkp?.occurredAt);
    });

    it('records one event when a polygon is drawn', async () => {
      const polygon = await draw();
      const events = await timelineOf();
      expect(events).toHaveLength(3);
      expect(events[2]).toMatchObject({
        type: 'polygon.created',
        actor: { kind: 'commander', userId: commander.userId },
        subject: { kind: 'polygon', id: polygon.id, label: 'פוליגון 1' },
      });
    });

    it('records a boundary change, and nothing for a change that was refused', async () => {
      const polygon = await draw();
      await addParticipant(ctx.db, {
        missionId,
        callsign: 4,
        polygonId: polygon.id,
        position: INSIDE_ONLY_AREA,
      });

      const warned = await patch(polygon.id, { geometry: SMALLER });
      expect(warned.statusCode).toBe(409);
      expect(await typesOf()).not.toContain('polygon.boundary_changed');

      const confirmed = await patch(polygon.id, { geometry: SMALLER, confirmSearchersOutside: true });
      expect(confirmed.statusCode).toBe(200);
      const changed = (await timelineOf()).filter((e) => e.type === 'polygon.boundary_changed');
      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({
        subject: { kind: 'polygon', id: polygon.id, label: 'פוליגון 1' },
        details: { searchersOutside: 1 },
      });
    });

    it('records a boundary change with nobody outside', async () => {
      const polygon = await draw();
      expect((await patch(polygon.id, { geometry: SMALLER })).statusCode).toBe(200);
      const changed = (await timelineOf()).filter((e) => e.type === 'polygon.boundary_changed');
      expect(changed).toHaveLength(1);
      expect(changed[0]?.details).toEqual({ searchersOutside: 0 });
    });

    it('does not record a rename: it is not a significant event', async () => {
      const polygon = await draw();
      const before = await timelineOf();
      expect((await patch(polygon.id, { name: 'ואדי צפוני' })).statusCode).toBe(200);
      expect(await timelineOf()).toEqual(before);
    });

    it('names a reshaped polygon by its name after the change', async () => {
      const polygon = await draw();
      await patch(polygon.id, { name: 'ואדי צפוני', geometry: SMALLER });
      const changed = (await timelineOf()).find((e) => e.type === 'polygon.boundary_changed');
      expect(changed?.subject.label).toBe('ואדי צפוני');
    });

    it('records a deletion under the name the polygon had then, and nothing for a refused one', async () => {
      const polygon = await draw();
      await patch(polygon.id, { name: 'ואדי צפוני' });
      await addParticipant(ctx.db, { missionId, callsign: 3, polygonId: polygon.id });
      const refused = await inject({ method: 'DELETE', url: polygonUrl(polygon.id) });
      expect(refused.statusCode).toBe(409);
      expect(await typesOf()).not.toContain('polygon.deleted');

      await ctx.db.update(participations).set({ polygonId: null, status: 'available' });
      const res = await inject({ method: 'DELETE', url: polygonUrl(polygon.id) });
      expect(res.statusCode).toBe(204);
      const deleted = (await timelineOf()).filter((e) => e.type === 'polygon.deleted');
      expect(deleted).toHaveLength(1);
      expect(deleted[0]?.subject).toMatchObject({ kind: 'polygon', id: polygon.id, label: 'ואדי צפוני' });
    });

    it('records nothing for a change that fails', async () => {
      const bowtie: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [35.12, 31.77],
            [35.13, 31.78],
            [35.13, 31.77],
            [35.12, 31.78],
            [35.12, 31.77],
          ],
        ],
      };
      const invalid = await inject({ method: 'POST', url: polygonUrl(), payload: { geometry: bowtie } });
      expect(invalid.statusCode).toBe(400);
      await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
      const blocked = await inject({ method: 'POST', url: polygonUrl(), payload: { geometry: AREA } });
      expect(blocked.statusCode).toBe(409);
      expect(await typesOf()).toEqual(['mission.created', 'lkp.changed']);
    });

    it('has a recorder for every type, resolving the searcher actor', async () => {
      const searcher = await signInSearcher(ctx);
      const participantId = await addParticipant(ctx.db, { missionId, callsign: 7, searcherId: searcher.searcherId });
      await ctx.db.delete(timelineEvents);
      const at = new Date('2026-10-03T10:00:00.000Z').toISOString();
      const subject = (kind: RecordEventInput['subject']['kind'], label: string | null = 'ואדי') => ({
        kind,
        id: participantId,
        label,
      });
      const bySearcher = { role: 'searcher', userId: searcher.userId, searcherId: searcher.searcherId } as const;
      const byCommander = { role: 'commander', userId: commander.userId } as const;
      const samples: Record<TimelineEventType, RecordEventInput> = {
        'mission.created': { missionId, actor: byCommander, type: 'mission.created', subject: subject('mission'), details: {} },
        'mission.paused': { missionId, actor: byCommander, type: 'mission.paused', subject: subject('mission'), details: {} },
        'mission.resumed': { missionId, actor: byCommander, type: 'mission.resumed', subject: subject('mission'), details: {} },
        'mission.ended': {
          missionId,
          actor: byCommander,
          type: 'mission.ended',
          subject: subject('mission'),
          details: { outcome: 'stopped' },
        },
        'lkp.changed': {
          missionId,
          actor: bySearcher,
          type: 'lkp.changed',
          subject: subject('lkp', null),
          details: { observedAt: at, previousObservedAt: null },
        },
        'polygon.created': { missionId, actor: byCommander, type: 'polygon.created', subject: subject('polygon'), details: {} },
        'polygon.boundary_changed': {
          missionId,
          actor: byCommander,
          type: 'polygon.boundary_changed',
          subject: subject('polygon'),
          details: { searchersOutside: 0 },
        },
        'polygon.deleted': { missionId, actor: byCommander, type: 'polygon.deleted', subject: subject('polygon'), details: {} },
        'search.started': { missionId, actor: bySearcher, type: 'search.started', subject: subject('polygon'), details: {} },
        'report.submitted': { missionId, actor: bySearcher, type: 'report.submitted', subject: subject('report', 'מפגע'), details: {} },
        'coverage.threshold_reached': {
          missionId,
          actor: 'system',
          type: 'coverage.threshold_reached',
          subject: subject('polygon'),
          details: { threshold: 90 },
        },
        'contact.lost': {
          missionId,
          actor: 'system',
          type: 'contact.lost',
          subject: { ...subject('participant', 'מחפש 7'), callsign: 7 },
          details: {},
        },
        'sos.activated': { missionId, actor: bySearcher, type: 'sos.activated', subject: subject('sos', null), details: {} },
      };

      for (const type of TIMELINE_EVENT_TYPES) {
        await recordEvent(ctx.db, samples[type]);
        const rows = await ctx.db.select().from(timelineEvents);
        expect(rows).toHaveLength(1);
        const listed = await timelineOf();
        expect(listed).toHaveLength(1);
        expect(listed[0]?.type).toBe(type);
        await ctx.db.delete(timelineEvents);
      }

      await recordEvent(ctx.db, samples['search.started']);
      expect((await timelineOf())[0]?.actor).toEqual({
        kind: 'searcher',
        participantId,
        callsign: 7,
        name: expect.any(String),
      });
    });

    it('rejects an actor who is not in the mission', async () => {
      const searcher = await signInSearcher(ctx);
      await expect(
        recordEvent(ctx.db, {
          missionId,
          actor: { role: 'searcher', userId: searcher.userId, searcherId: searcher.searcherId },
          type: 'search.started',
          subject: { kind: 'polygon', id: UNKNOWN_ID, label: 'ואדי' },
          details: {},
        }),
      ).rejects.toThrow('Timeline actor not found');
    });
  });

  describe('reading', () => {
    it('returns events oldest first by when they happened, then by recording order', async () => {
      await ctx.db.delete(timelineEvents);
      const at = (minute: number) => new Date(Date.UTC(2026, 9, 3, 10, minute));
      const record = (occurredAt: Date, label: string) =>
        recordEvent(ctx.db, {
          missionId,
          actor: { role: 'commander', userId: commander.userId },
          type: 'polygon.created',
          subject: { kind: 'polygon', id: UNKNOWN_ID, label },
          details: {},
          occurredAt,
        });
      await record(at(3), 'c');
      await record(at(1), 'a');
      await record(at(2), 'b1');
      await record(at(2), 'b2');
      expect((await timelineOf()).map((e) => e.subject.label)).toEqual(['a', 'b1', 'b2', 'c']);
    });

    it("hides another commander's mission as not found", async () => {
      const other = injectAs(ctx, await signInCommander(ctx));
      const res = await other({ method: 'GET', url: `/api/missions/${missionId}/timeline` });
      expect(res.statusCode).toBe(404);
      expect(errorCode(res)).toBe('NOT_FOUND');
    });

    it('forbids a searcher who takes part in the mission', async () => {
      const searcher = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId, callsign: 2, searcherId: searcher.searcherId });
      const res = await injectAs(ctx, searcher)({ method: 'GET', url: `/api/missions/${missionId}/timeline` });
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
    });

    it('needs a session, a known mission and a well-formed id', async () => {
      const anonymous = await ctx.app.inject({ method: 'GET', url: `/api/missions/${missionId}/timeline` });
      expect(anonymous.statusCode).toBe(401);
      const unknown = await inject({ method: 'GET', url: `/api/missions/${UNKNOWN_ID}/timeline` });
      expect(unknown.statusCode).toBe(404);
      const malformed = await inject({ method: 'GET', url: '/api/missions/not-an-id/timeline' });
      expect(malformed.statusCode).toBe(400);
    });

    it("returns only the requested mission's events", async () => {
      const second = await createMission('מסע שני');
      await draw();
      expect(await typesOf(second)).toEqual(['mission.created', 'lkp.changed']);
      expect(await typesOf()).toHaveLength(3);
    });

    it('is readable after the mission ended, with its full history', async () => {
      await draw();
      await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, missionId));
      expect(await typesOf()).toEqual(['mission.created', 'lkp.changed', 'polygon.created']);
    });

    it('returns an empty list for a mission without events', async () => {
      await ctx.db.delete(timelineEvents);
      expect(await timelineOf()).toEqual([]);
    });
  });
});
