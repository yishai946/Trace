import { Mission } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { missions } from '../../../db/schema';
import { addParticipant, createTestApp, injectAs, resetDb, signInCommander, type TestContext } from '../../../testing';
import { lkp, rallyPoint } from '../fixtures';

/**
 * An ended mission is read-only (decision 52, UC-C20): every route that changes mission data answers 409. The routes
 * of a searcher whose activity goes on are the exception, listed with the reason. A new write route has to be put in
 * one of the two lists, so it is decided on purpose.
 */
const OPEN_AFTER_END: Record<string, string> = {
  'POST /api/missions': 'creates a new mission, not a change to the ended one',
  'PUT /api/searchers/me': 'the searcher profile, not mission data',
  'PUT /api/me/phone': 'the commander profile, not mission data',
  'PUT /api/push-token': 'the device of the user, not mission data',
  'DELETE /api/push-token': 'the device of the user, not mission data',
  'POST /api/join/:code': 'a searcher joins a mission by code; the join itself refuses an ended mission (decision 82)',
  'POST /api/missions/:missionId/sos': 'a searcher whose activity goes on can still ask for help, in any state',
  'POST /api/missions/:missionId/sos/:sosId/close': 'the commander closes an SOS that was open when the mission ended',
  'POST /api/missions/:missionId/track-points': 'a searcher whose activity goes on keeps recording (decision 65)',
  'PUT /api/missions/:missionId/participation/gps': 'the device state of a searcher whose activity goes on',
  'PUT /api/missions/:missionId/participation/battery': 'the device state of a searcher whose activity goes on',
  'POST /api/missions/:missionId/participants/:participantId/end': 'the commander ends the activity left in the field',
  'POST /api/missions/:missionId/participation/finish-activity': 'the searcher leaves the field (UC-F15)',
  'PUT /api/missions/:missionId/participation/messages/:messageId/receipt': 'a searcher confirms a message they got',
};

/** Refused too, but they need a report, a sighting or a searcher of their own: the module's own test covers each. */
const REFUSED_ELSEWHERE = [
  'POST /api/missions/:missionId/reports (reports.test)',
  'PUT /api/missions/:missionId/reports/:reportId/photo (reports.test)',
  'POST /api/missions/:missionId/reports/:reportId/handle (reports.manage.test)',
  'PATCH /api/missions/:missionId/reports/:reportId (reports.manage.test)',
  'DELETE /api/missions/:missionId/reports/:reportId (reports.manage.test)',
  'PUT /api/missions/:missionId/sightings/:sightingId/lkp-decision (sightings.test)',
  'PUT /api/missions/:missionId/participants/:participantId/assignment (participants.test)',
  'POST /api/missions/:missionId/participation/search/start (participants.startSearch.test)',
  'POST /api/missions/:missionId/participation/search/pause (participants.pause.test)',
  'POST /api/missions/:missionId/participation/search/resume (participants.pause.test)',
  'POST /api/missions/:missionId/participation/search/finish (participants.finish.test)',
  'PUT /api/missions/:missionId/photo (missions.details.test)',
  'PATCH /api/missions/:missionId/polygons/:polygonId (polygons.test)',
  'DELETE /api/missions/:missionId/polygons/:polygonId (polygons.test)',
].map((entry) => entry.replace(/ \(.*\)$/, ''));

const ring = [
  [35.12, 31.77],
  [35.14, 31.77],
  [35.14, 31.79],
  [35.12, 31.77],
];
const REFUSED: Array<[string, string, object]> = [
  ['PUT', '/rally-point', { rallyPoint: { type: 'Point', coordinates: [35.15, 31.8] } }],
  ['PUT', '/details', { name: 'מסע 0412', missingPerson: { name: 'נועם אברהם', age: 75 } }],
  [
    'POST',
    '/end-located',
    { position: { type: 'Point', coordinates: [35.131, 31.775] }, locatedAt: '2026-10-03T16:40:00+03:00' },
  ],
  ['POST', '/stop', { reason: 'weather', note: 'ערפל כבד' }],
  ['POST', '/pause', {}],
  ['POST', '/resume', {}],
  ['POST', '/polygons', { name: 'A', geometry: { type: 'Polygon', coordinates: [ring] } }],
  ['POST', '/messages', { target: { kind: 'mission' }, urgency: 'normal', body: 'חזרו לכינוס' }],
  [
    'POST',
    '/sightings',
    {
      position: { type: 'Point', coordinates: [35.13, 31.77] },
      observedAt: '2026-10-03T14:22:00+03:00',
      description: 'מטייל ראה אדם',
      source: 'witness',
    },
  ],
];

const toFastify = (path: string) => path.replaceAll(/\{(\w+)\}/g, ':$1');

describe('an ended mission is read-only (decision 52)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('has every write route refused, covered by its module test, or listed as open with a reason', async () => {
    await ctx.app.ready();
    const { paths } = ctx.app.swagger() as { paths: Record<string, Record<string, unknown>> };
    const writes = Object.entries(paths).flatMap(([path, methods]) =>
      Object.keys(methods)
        .filter((method) => ['post', 'put', 'patch', 'delete'].includes(method))
        .map((method) => `${method.toUpperCase()} ${toFastify(path)}`),
    );
    const refused = REFUSED.map(([method, suffix]) => `${method} /api/missions/:missionId${suffix}`);
    const known = new Set([...refused, ...REFUSED_ELSEWHERE, ...Object.keys(OPEN_AFTER_END)]);
    expect(writes.filter((route) => !known.has(route))).toEqual([]);
    expect([...known].filter((route) => !writes.includes(route))).toEqual([]);
  });

  it.each(REFUSED)('refuses %s %s on an ended mission', async (method, suffix, payload) => {
    await resetDb(ctx.db);
    const inject = injectAs(ctx, await signInCommander(ctx));
    const { id } = Mission.parse(
      (await inject({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } })).json(),
    );
    await addParticipant(ctx.db, { missionId: id, callsign: 1 });
    await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, id));
    const res = await inject({ method: method as 'PUT', url: `/api/missions/${id}${suffix}`, payload });
    expect(res.statusCode).toBe(409);
  });
});
