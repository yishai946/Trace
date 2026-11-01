import { isJoinCode } from '@trace/domain';
import { ApiError, Mission, MissionList } from '@trace/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb } from '../../testing';
import { createMission } from './missions.service';

const rallyPoint = { type: 'Point', coordinates: [35.1335, 31.7835] };

describe('missions', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx.db));
  afterAll(() => ctx.close());

  const post = (payload: object) => ctx.app.inject({ method: 'POST', url: '/api/missions', payload });

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
  });

  it('lists missions newest first and gets one by id', async () => {
    const first = Mission.parse((await post({ name: 'ראשון', rallyPoint })).json());
    const second = Mission.parse((await post({ name: 'שני', rallyPoint })).json());

    const list = MissionList.parse((await ctx.app.inject({ method: 'GET', url: '/api/missions' })).json());
    expect(list.map((m) => m.id)).toEqual([second.id, first.id]);
    expect(list[1]?.lkp).toBeNull();

    const one = await ctx.app.inject({ method: 'GET', url: `/api/missions/${first.id}` });
    expect(Mission.parse(one.json()).name).toBe('ראשון');
  });

  it('returns 404 for an unknown mission and 400 for a malformed id', async () => {
    const missing = await ctx.app.inject({ method: 'GET', url: '/api/missions/00000000-0000-4000-8000-000000000000' });
    expect(missing.statusCode).toBe(404);
    const malformed = await ctx.app.inject({ method: 'GET', url: '/api/missions/not-a-uuid' });
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
    };
    const a = await createMission(ctx.db, input, random);
    const b = await createMission(ctx.db, input, random);
    expect(a.joinCode).toBe('AA-AAA');
    expect(b.joinCode).not.toBe(a.joinCode);
  });
});
