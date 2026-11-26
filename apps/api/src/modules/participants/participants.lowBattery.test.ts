import { Mission, TimelineEventList, type MissionEvent } from '@trace/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

describe('low-battery alert (UC-S04, decision 45)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;
  let user: Awaited<ReturnType<typeof signInSearcher>>;
  let participationId: string;
  let published: MissionEvent[];

  beforeAll(async () => {
    ctx = await createTestApp();
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event, options) => {
      published.push(event);
      publish(event, options);
    };
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    published = [];
    ctx.pushSender.sent.length = 0;
    commander = injectAs(ctx, await signInCommander(ctx));
    mission = Mission.parse(
      (
        await commander({
          method: 'POST',
          url: '/api/missions',
          payload: {
            name: 'מסע',
            rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
            lkp: {
              position: { type: 'Point', coordinates: [35.137, 31.769] },
              observedAt: '2026-10-03T13:05:00+03:00',
            },
          },
        })
      ).json(),
    );
    user = await signInSearcher(ctx, { name: 'אלון שגיא' });
    participationId = await addParticipant(ctx.db, { missionId: mission.id, callsign: 7, searcherId: user.searcherId });
    await injectAs(
      ctx,
      user,
    )({
      method: 'PUT',
      url: '/api/push-token',
      payload: { token: 'ExponentPushToken[low-battery]' },
    });
  });

  let minute = 0;
  const report = (level: number) =>
    injectAs(
      ctx,
      user,
    )({
      method: 'PUT',
      url: `/api/missions/${mission.id}/participation/battery`,
      payload: { level, measuredAt: new Date(Date.now() - 600_000 + ++minute * 1000).toISOString() },
    });
  const alerts = async () =>
    TimelineEventList.parse(
      (await commander({ method: 'GET', url: `/api/missions/${mission.id}/timeline` })).json(),
    ).filter((event) => event.type === 'battery.low');

  it('records one alert on the Timeline, tells the commander and pushes the searcher when the level falls below', async () => {
    await report(60);
    expect(await alerts()).toEqual([]);
    expect(ctx.pushSender.sent).toEqual([]);

    expect((await report(19)).statusCode).toBe(204);

    expect(await alerts()).toMatchObject([
      {
        type: 'battery.low',
        actor: { kind: 'system' },
        subject: { kind: 'participant', id: participationId, callsign: 7 },
        details: { level: 19 },
      },
    ]);
    expect(published.filter((event) => event.type === 'timeline.recorded')).toHaveLength(1);
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    expect(ctx.pushSender.sent[0]?.tokens).toEqual(['ExponentPushToken[low-battery]']);
    expect(ctx.pushSender.sent[0]?.message.body).toContain('מטען');
  });

  it('alerts on a first reading that is already low', async () => {
    await report(12);
    expect(await alerts()).toHaveLength(1);
  });

  it('does not alert at the threshold, nor repeat while the level stays below', async () => {
    await report(20);
    expect(await alerts()).toEqual([]);
    await report(19);
    await report(18);
    await report(5);
    expect(await alerts()).toHaveLength(1);
    await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ctx.pushSender.sent).toHaveLength(1);
  });

  it('alerts again after the phone charged back above the threshold', async () => {
    await report(15);
    await report(40);
    await report(10);
    expect(await alerts()).toHaveLength(2);
  });

  it('does not alert for an older reading that arrives late', async () => {
    await report(60);
    await injectAs(
      ctx,
      user,
    )({
      method: 'PUT',
      url: `/api/missions/${mission.id}/participation/battery`,
      payload: { level: 5, measuredAt: new Date(Date.now() - 3_600_000).toISOString() },
    });
    expect(await alerts()).toEqual([]);
  });
});
