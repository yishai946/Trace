import { isJoinCode, MAX_PHOTO_BYTES } from '@trace/domain';
import { ApiError, Mission, MissionList } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  PNG_BYTES as PNG,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
  type TestUser,
} from '../../testing';
import { createMission } from './missions.service';

const rallyPoint = { type: 'Point', coordinates: [35.1335, 31.7835] };
const lkp = { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' };

/** The smallest file that passes as a JPEG: its signature and a few more bytes. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);

const issuePaths = (body: unknown) => {
  const details = ApiError.parse(body).error.details as { issues: { path: string }[] };
  return details.issues.map((issue) => issue.path);
};

describe('missions', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
  });
  afterAll(() => ctx.close());

  const post = (payload: object) => inject({ method: 'POST', url: '/api/missions', payload });

  it('creates an active mission with a join code, rally point and LKP', async () => {
    const res = await post({
      name: 'מסע 0412',
      missingPerson: { name: 'נועם אברהם', age: 74, disappearedAt: '2026-10-03T11:20:00+03:00' },
      rallyPoint,
      lkp,
    });
    expect(res.statusCode).toBe(201);
    const mission = Mission.parse(res.json());
    expect(mission.status).toBe('active');
    expect(isJoinCode(mission.joinCode)).toBe(true);
    expect(mission.rallyPoint).toEqual(rallyPoint);
    expect(mission.missingPerson).toMatchObject({ name: 'נועם אברהם', age: 74, description: null });
    expect(mission.missingPerson.disappearedAt).toBe('2026-10-03T08:20:00.000Z');
    expect(mission.lkp?.position.coordinates).toEqual([35.137, 31.769]);
  });

  it('requires a rally point (decision 91)', async () => {
    const res = await post({ name: 'מסע' });
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(issuePaths(res.json())).toContain('/rallyPoint');
  });

  it('requires an LKP', async () => {
    const res = await post({ name: 'מסע', rallyPoint });
    expect(res.statusCode).toBe(400);
    expect(issuePaths(res.json())).toContain('/lkp');
  });

  it('names a missing mission name', async () => {
    const res = await post({ name: ' ', rallyPoint, lkp });
    expect(res.statusCode).toBe(400);
    expect(issuePaths(res.json())).toContain('/name');
  });

  it('lets only commanders create missions', async () => {
    const searcher = await signInSearcher(ctx);
    const res = await injectAs(
      ctx,
      searcher,
    )({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } });
    expect(res.statusCode).toBe(403);
    expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
  });

  it('gives every mission its own join code', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5; i++)
      codes.add(Mission.parse((await post({ name: `מסע ${i}`, rallyPoint, lkp })).json()).joinCode);
    expect(codes.size).toBe(5);
  });

  it('lists missions newest first and gets one by id', async () => {
    const first = Mission.parse((await post({ name: 'ראשון', rallyPoint, lkp })).json());
    const second = Mission.parse((await post({ name: 'שני', rallyPoint, lkp })).json());

    const list = MissionList.parse((await inject({ method: 'GET', url: '/api/missions' })).json());
    expect(list.map((m) => m.id)).toEqual([second.id, first.id]);

    const one = await inject({ method: 'GET', url: `/api/missions/${first.id}` });
    expect(Mission.parse(one.json()).name).toBe('ראשון');
  });

  it('returns 404 for an unknown mission and 400 for a malformed id', async () => {
    const missing = await inject({ method: 'GET', url: '/api/missions/00000000-0000-4000-8000-000000000000' });
    expect(missing.statusCode).toBe(404);
    const malformed = await inject({ method: 'GET', url: '/api/missions/not-a-uuid' });
    expect(malformed.statusCode).toBe(400);
  });

  it('retries when a generated join code is already taken', async () => {
    // Both missions first draw AA-AAA; the second then retries and draws BB-BBB.
    const sequence = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
    let i = 0;
    const random = () => sequence[i++ % sequence.length] ?? 0;
    const input = {
      name: 'מסע',
      missingPerson: { name: null, age: null, disappearedAt: null, description: null, additionalInfo: null },
      rallyPoint: { type: 'Point' as const, coordinates: [35.13, 31.78] as [number, number] },
      lkp: {
        position: { type: 'Point' as const, coordinates: [35.137, 31.769] as [number, number] },
        observedAt: lkp.observedAt,
      },
      commanderId: commander.userId,
    };
    const a = await createMission(ctx.db, input, random);
    const b = await createMission(ctx.db, input, random);
    expect(a.joinCode).toBe('AA-AAA');
    expect(b.joinCode).not.toBe(a.joinCode);
  });
});

describe('missing person photo', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    const created = await inject({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } });
    missionId = Mission.parse(created.json()).id;
  });
  afterAll(() => ctx.close());

  const upload = (payload: Buffer, contentType: string, as = inject) =>
    as({ method: 'PUT', url: `/api/missions/${missionId}/photo`, payload, headers: { 'content-type': contentType } });

  it('replaces the photo of a paused mission', async () => {
    await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
    const res = await upload(PNG, 'image/png');
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).missingPerson.photoUrl).not.toBeNull();
  });

  it('starts without a photo', async () => {
    const mission = Mission.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}` })).json());
    expect(mission.missingPerson.photoUrl).toBeNull();
    const photo = await inject({ method: 'GET', url: `/api/missions/${missionId}/photo` });
    expect(photo.statusCode).toBe(404);
  });

  it('stores a photo and serves it in the mission details', async () => {
    const res = await upload(PNG, 'image/png');
    expect(res.statusCode).toBe(200);
    const photoUrl = Mission.parse(res.json()).missingPerson.photoUrl;
    expect(photoUrl?.startsWith(`/api/missions/${missionId}/photo?v=`)).toBe(true);

    const listed = MissionList.parse((await inject({ method: 'GET', url: '/api/missions' })).json());
    expect(listed[0]?.missingPerson.photoUrl).toBe(photoUrl);

    const photo = await inject({ method: 'GET', url: photoUrl ?? '' });
    expect(photo.statusCode).toBe(200);
    expect(photo.headers['content-type']).toBe('image/png');
    expect(photo.rawPayload.equals(PNG)).toBe(true);
  });

  it('replaces the photo with a new version', async () => {
    const first = Mission.parse((await upload(PNG, 'image/png')).json()).missingPerson.photoUrl;
    const second = Mission.parse((await upload(JPEG, 'image/jpeg')).json()).missingPerson.photoUrl;
    expect(second).not.toBe(first);
    const photo = await inject({ method: 'GET', url: `/api/missions/${missionId}/photo` });
    expect(photo.headers['content-type']).toBe('image/jpeg');
  });

  it('rejects a file that is not an image, whatever its declared type', async () => {
    const pdf = await upload(Buffer.from('%PDF-1.7 not an image'), 'image/png');
    expect(pdf.statusCode).toBe(415);
    expect(ApiError.parse(pdf.json()).error.code).toBe('UNSUPPORTED_PHOTO');

    const declaredPdf = await upload(Buffer.from('%PDF-1.7'), 'application/pdf');
    expect(declaredPdf.statusCode).toBe(415);
    expect(ApiError.parse(declaredPdf.json()).error.code).toBe('UNSUPPORTED_PHOTO');
  });

  it('rejects a photo larger than the limit', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_PHOTO_BYTES)]);
    const res = await upload(big, 'image/png');
    expect(res.statusCode).toBe(413);
    expect(ApiError.parse(res.json()).error.code).toBe('PHOTO_TOO_LARGE');
  });

  it('shows the photo to searchers in the mission but lets only the commander change it', async () => {
    await upload(PNG, 'image/png');
    const searcher = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 1, searcherId: searcher.searcherId });
    const asSearcher = injectAs(ctx, searcher);

    const photo = await asSearcher({ method: 'GET', url: `/api/missions/${missionId}/photo` });
    expect(photo.statusCode).toBe(200);
    expect((await upload(JPEG, 'image/jpeg', asSearcher)).statusCode).toBe(403);
  });

  it('hides the photo of a mission the user has no part in', async () => {
    await upload(PNG, 'image/png');
    const other = injectAs(ctx, await signInCommander(ctx));
    expect((await other({ method: 'GET', url: `/api/missions/${missionId}/photo` })).statusCode).toBe(404);
    expect((await upload(PNG, 'image/png', other)).statusCode).toBe(404);
  });

  it('turns an outsider away before reading the photo', async () => {
    const other = injectAs(ctx, await signInCommander(ctx));
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_PHOTO_BYTES)]);
    // 404, not 413: the access check runs before the body is read.
    expect((await upload(big, 'image/png', other)).statusCode).toBe(404);
  });

  it('lets the browser keep only the current version of the photo, and never sniff it', async () => {
    const photoUrl = Mission.parse((await upload(PNG, 'image/png')).json()).missingPerson.photoUrl ?? '';
    const current = await inject({ method: 'GET', url: photoUrl });
    expect(current.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(current.headers['x-content-type-options']).toBe('nosniff');

    const unversioned = await inject({ method: 'GET', url: `/api/missions/${missionId}/photo` });
    expect(unversioned.headers['cache-control']).toBe('private, no-cache');
    const stale = await inject({ method: 'GET', url: `/api/missions/${missionId}/photo?v=1` });
    expect(stale.headers['cache-control']).toBe('private, no-cache');
  });

  it('keeps the photo of an ended mission as it was', async () => {
    await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, missionId));
    const res = await upload(PNG, 'image/png');
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
  });
});

describe('rally point', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    const created = await inject({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } });
    missionId = Mission.parse(created.json()).id;
  });
  afterAll(() => ctx.close());

  const moved = { type: 'Point', coordinates: [35.15, 31.8] };
  const change = (payload: unknown, as = inject, id = missionId) =>
    as({ method: 'PUT', url: `/api/missions/${id}/rally-point`, payload: payload as object });
  const current = async () =>
    Mission.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}` })).json()).rallyPoint;

  it('replaces the rally point; only one stays', async () => {
    const before = Mission.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}` })).json());
    const res = await change({ rallyPoint: moved });
    expect(res.statusCode).toBe(200);
    const mission = Mission.parse(res.json());
    expect(mission.rallyPoint).toEqual(moved);
    expect(await current()).toEqual(moved);
    expect(Date.parse(mission.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));

    const again = { type: 'Point', coordinates: [35.2, 31.9] };
    expect(Mission.parse((await change({ rallyPoint: again })).json()).rallyPoint).toEqual(again);
    expect(await current()).toEqual(again);
  });

  it.each([
    ['latitude above 90', { rallyPoint: { type: 'Point', coordinates: [35, 91] } }],
    ['longitude above 180', { rallyPoint: { type: 'Point', coordinates: [181, 31] } }],
    ['longitude below -180', { rallyPoint: { type: 'Point', coordinates: [-181, 31] } }],
    ['text coordinates', { rallyPoint: { type: 'Point', coordinates: ['35', '31'] } }],
    ['no body', undefined],
    ['a polygon', { rallyPoint: { type: 'Polygon', coordinates: [[[0, 0]]] } }],
    ['one coordinate', { rallyPoint: { type: 'Point', coordinates: [35] } }],
  ])('rejects %s and keeps the point', async (_name, payload) => {
    const res = await change(payload);
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(await current()).toEqual(rallyPoint);
  });

  it('lets only the mission commander change it', async () => {
    const searcher = await signInSearcher(ctx);
    const outsider = await signInSearcher(ctx);
    const other = await signInCommander(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 1, searcherId: searcher.searcherId });

    expect((await change({ rallyPoint: moved }, injectAs(ctx, searcher))).statusCode).toBe(403);
    expect((await change({ rallyPoint: moved }, injectAs(ctx, outsider))).statusCode).toBe(404);
    expect((await change({ rallyPoint: moved }, injectAs(ctx, other))).statusCode).toBe(404);
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/missions/${missionId}/rally-point`,
      payload: { rallyPoint: moved },
    });
    expect(res.statusCode).toBe(401);
    expect(await current()).toEqual(rallyPoint);
  });

  it('answers 400 for a malformed id and 404 for an unknown one', async () => {
    expect((await change({ rallyPoint: moved }, inject, 'not-a-uuid')).statusCode).toBe(400);
    const unknown = await change({ rallyPoint: moved }, inject, '00000000-0000-4000-8000-000000000000');
    expect(unknown.statusCode).toBe(404);
  });

  it.each(['ended_located', 'ended_stopped'] as const)('refuses a mission that is %s', async (status) => {
    await ctx.db.update(missions).set({ status }).where(eq(missions.id, missionId));
    const res = await change({ rallyPoint: moved });
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
    expect(await current()).toEqual(rallyPoint);
  });

  it('allows a paused mission', async () => {
    await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
    expect((await change({ rallyPoint: moved })).statusCode).toBe(200);
    expect(await current()).toEqual(moved);
  });

  it('shows the new point to a searcher who fetches the mission later', async () => {
    const searcher = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 1, searcherId: searcher.searcherId });
    await change({ rallyPoint: moved });
    const res = await injectAs(ctx, searcher)({ method: 'GET', url: `/api/missions/${missionId}` });
    expect(Mission.parse(res.json()).rallyPoint).toEqual(moved);
  });
});

describe('mission details (UC-C03)', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    const created = await inject({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        missingPerson: { name: 'נועם אברהם', age: 74, description: 'מעיל חום' },
        rallyPoint,
        lkp,
      },
    });
    missionId = Mission.parse(created.json()).id;
  });
  afterAll(() => ctx.close());

  const details = {
    name: 'מסע 0412',
    missingPerson: {
      name: 'נועם אברהם',
      age: 75,
      disappearedAt: '2026-10-03T11:20:00+03:00',
      description: 'מעיל חום, כובע צמר אפור',
      additionalInfo: 'דמנציה קלה',
    },
  };
  const edit = (payload: unknown, as = inject, id = missionId) =>
    as({ method: 'PUT', url: `/api/missions/${id}/details`, payload: payload as object });
  const current = async () =>
    Mission.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}` })).json());

  it('saves the new details of an active mission and returns them', async () => {
    const before = await current();
    const res = await edit(details);
    expect(res.statusCode).toBe(200);
    const mission = Mission.parse(res.json());
    expect(mission.name).toBe('מסע 0412');
    expect(mission.missingPerson).toMatchObject({
      name: 'נועם אברהם',
      age: 75,
      description: 'מעיל חום, כובע צמר אפור',
      additionalInfo: 'דמנציה קלה',
    });
    expect(mission.missingPerson.disappearedAt).toBe('2026-10-03T08:20:00.000Z');
    expect(Date.parse(mission.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
    expect(await current()).toEqual(mission);
    expect(mission).toMatchObject({
      status: before.status,
      joinCode: before.joinCode,
      rallyPoint: before.rallyPoint,
      lkp: before.lkp,
    });
    expect(mission.missingPerson.photoUrl).toBe(before.missingPerson.photoUrl);
  });

  it('allows a paused mission', async () => {
    await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
    expect((await edit(details)).statusCode).toBe(200);
    expect((await current()).name).toBe('מסע 0412');
  });

  it.each(['ended_located', 'ended_stopped'] as const)(
    'refuses a mission that is %s and keeps its details',
    async (status) => {
      await ctx.db.update(missions).set({ status }).where(eq(missions.id, missionId));
      const before = await current();
      const res = await edit(details);
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
      expect(await current()).toEqual(before);
    },
  );

  it('clears fields sent empty or null', async () => {
    const res = await edit({
      name: 'מסע',
      missingPerson: { name: '  ', age: null, disappearedAt: null, description: '', additionalInfo: null },
    });
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).missingPerson).toEqual({
      name: null,
      age: null,
      disappearedAt: null,
      description: null,
      additionalInfo: null,
      photoUrl: null,
    });
  });

  it.each([
    ['an empty name', { ...details, name: ' ' }],
    ['a name over 120 characters', { ...details, name: 'א'.repeat(121) }],
    ['no missing-person details', { name: 'מסע' }],
    ['an age over 130', { ...details, missingPerson: { ...details.missingPerson, age: 131 } }],
    ['a negative age', { ...details, missingPerson: { ...details.missingPerson, age: -1 } }],
    ['a fractional age', { ...details, missingPerson: { ...details.missingPerson, age: 1.5 } }],
    ['an age as text', { ...details, missingPerson: { ...details.missingPerson, age: '75' } }],
    [
      'a time without an offset',
      { ...details, missingPerson: { ...details.missingPerson, disappearedAt: '2026-10-03T11:20:00' } },
    ],
    [
      'a description over 2000 characters',
      { ...details, missingPerson: { ...details.missingPerson, description: 'א'.repeat(2001) } },
    ],
    ['no body', undefined],
  ])('rejects %s and keeps the details', async (_name, payload) => {
    const before = await current();
    const res = await edit(payload);
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(await current()).toEqual(before);
  });

  it('lets only the mission commander edit', async () => {
    const searcher = await signInSearcher(ctx);
    const outsider = await signInSearcher(ctx);
    const other = await signInCommander(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 1, searcherId: searcher.searcherId });
    const before = await current();

    expect((await edit(details, injectAs(ctx, searcher))).statusCode).toBe(403);
    expect((await edit(details, injectAs(ctx, outsider))).statusCode).toBe(404);
    expect((await edit(details, injectAs(ctx, other))).statusCode).toBe(404);
    const res = await ctx.app.inject({ method: 'PUT', url: `/api/missions/${missionId}/details`, payload: details });
    expect(res.statusCode).toBe(401);
    expect(await current()).toEqual(before);
  });

  it('answers 400 for a malformed id and 404 for an unknown one', async () => {
    expect((await edit(details, inject, 'not-a-uuid')).statusCode).toBe(400);
    const unknown = await edit(details, inject, '00000000-0000-4000-8000-000000000000');
    expect(unknown.statusCode).toBe(404);
  });

  it('shows the new details to a searcher who fetches the mission later', async () => {
    const searcher = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 1, searcherId: searcher.searcherId });
    expect((await edit(details)).statusCode).toBe(200);
    const res = await injectAs(ctx, searcher)({ method: 'GET', url: `/api/missions/${missionId}` });
    const mission = Mission.parse(res.json());
    expect(mission.name).toBe('מסע 0412');
    expect(mission.missingPerson.description).toBe('מעיל חום, כובע צמר אפור');
  });

  it('sends no push notification yet: which changes are significant is still open', async () => {
    const searcher = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 1, searcherId: searcher.searcherId });
    const registered = await injectAs(
      ctx,
      searcher,
    )({ method: 'PUT', url: '/api/push-token', payload: { token: 'ExponentPushToken[uc-c03]' } });
    expect(registered.statusCode).toBeLessThan(300);
    ctx.pushSender.sent.length = 0;

    expect((await edit(details)).statusCode).toBe(200);
    // Decision 34: a significant change notifies searchers. Which fields are significant is TBD (issue #7).
    expect(ctx.pushSender.sent).toEqual([]);
  });
});
