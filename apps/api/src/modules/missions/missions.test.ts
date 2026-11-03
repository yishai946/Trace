import { isJoinCode, MAX_PHOTO_BYTES } from '@trace/domain';
import { ApiError, Mission, MissionList } from '@trace/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { createMission } from './missions.service';

const rallyPoint = { type: 'Point', coordinates: [35.1335, 31.7835] };

/** The smallest files that pass as each format: their signature and a few more bytes. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
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
      lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
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

  it('names a missing mission name', async () => {
    const res = await post({ name: ' ', rallyPoint });
    expect(res.statusCode).toBe(400);
    expect(issuePaths(res.json())).toContain('/name');
  });

  it('lets only commanders create missions', async () => {
    const searcher = await signInSearcher(ctx);
    const res = await injectAs(
      ctx,
      searcher,
    )({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint } });
    expect(res.statusCode).toBe(403);
    expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
  });

  it('gives every mission its own join code', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5; i++)
      codes.add(Mission.parse((await post({ name: `מסע ${i}`, rallyPoint })).json()).joinCode);
    expect(codes.size).toBe(5);
  });

  it('lists missions newest first and gets one by id', async () => {
    const first = Mission.parse((await post({ name: 'ראשון', rallyPoint })).json());
    const second = Mission.parse((await post({ name: 'שני', rallyPoint })).json());

    const list = MissionList.parse((await inject({ method: 'GET', url: '/api/missions' })).json());
    expect(list.map((m) => m.id)).toEqual([second.id, first.id]);
    expect(list[1]?.lkp).toBeNull();

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
    const created = await inject({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint } });
    missionId = Mission.parse(created.json()).id;
  });
  afterAll(() => ctx.close());

  const upload = (payload: Buffer, contentType: string, as = inject) =>
    as({ method: 'PUT', url: `/api/missions/${missionId}/photo`, payload, headers: { 'content-type': contentType } });

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
});
