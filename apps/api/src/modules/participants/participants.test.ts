import { Mission, ParticipantList } from '@trace/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addParticipant, createTestApp, injectAs, resetDb, signInCommander, type TestContext } from '../../testing';

describe('participants', () => {
  let ctx: TestContext;
  let inject: ReturnType<typeof injectAs>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    inject = injectAs(ctx, await signInCommander(ctx));
  });
  afterAll(() => ctx.close());

  it('lists searchers by callsign with their last position', async () => {
    const res = await inject({
      method: 'POST',
      url: '/api/missions',
      payload: { name: 'מסע', rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] } },
    });
    const missionId = Mission.parse(res.json()).id;
    await addParticipant(ctx.db, { missionId, callsign: 9 });
    await addParticipant(ctx.db, { missionId, callsign: 4, position: [35.128, 31.775] });

    const list = ParticipantList.parse(
      (await inject({ method: 'GET', url: `/api/missions/${missionId}/participants` })).json(),
    );
    expect(list.map((p) => p.callsign)).toEqual([4, 9]);
    expect(list[0]).toMatchObject({ name: 'מחפש 4', status: 'available', position: [35.128, 31.775] });
    expect(list[1]?.position).toBeNull();
  });
});
