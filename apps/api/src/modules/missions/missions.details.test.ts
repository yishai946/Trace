import { ApiError, Mission, TimelineEventList, type MissionEvent, type TimelineEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { missions, participations } from '../../db/schema';
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
import { lkp, rallyPoint } from './fixtures';

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

  describe('notifying the searchers (decisions 34, 54)', () => {
    const token = 'ExponentPushToken[uc-c03]';
    const flagged = { ...details, notifySearchers: true };
    const allFields = ['name', 'missingPersonAge', 'disappearedAt', 'description', 'additionalInfo'];

    const timelineOf = async (): Promise<TimelineEvent[]> => {
      const res = await inject({ method: 'GET', url: `/api/missions/${missionId}/timeline` });
      expect(res.statusCode).toBe(200);
      return TimelineEventList.parse(res.json());
    };
    const changesOf = async () => (await timelineOf()).filter((event) => event.type === 'mission.details_changed');
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
    const searcherWithToken = async (callsign: number, missionOf = missionId, deviceToken = token) => {
      const searcher = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId: missionOf, callsign, searcherId: searcher.searcherId });
      const res = await injectAs(
        ctx,
        searcher,
      )({
        method: 'PUT',
        url: '/api/push-token',
        payload: { token: deviceToken },
      });
      expect(res.statusCode).toBeLessThan(300);
      return searcher;
    };
    const pushOf = (body: string) => ({
      tokens: [token],
      message: { title: 'פרטי הנעדר עודכנו', body, data: { missionId, screen: 'missing-person' } },
    });

    beforeEach(() => {
      ctx.pushSender.sent.length = 0;
    });

    it('records the change and pushes the searchers when the commander asks', async () => {
      await searcherWithToken(1);
      ctx.pushSender.sent.length = 0;
      expect((await edit(flagged)).statusCode).toBe(200);

      const changes = await changesOf();
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        actor: { kind: 'commander', userId: commander.userId, name: 'מנהל' },
        subject: { kind: 'mission', id: missionId, label: 'מסע 0412', callsign: null },
        details: { fields: allFields },
      });
      await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
      expect(ctx.pushSender.sent[0]).toEqual(
        pushOf('עודכנו: שם / מזהה מסע, גיל, זמן היעלמות, תיאור / לבוש, מידע רלוונטי'),
      );
    });

    it('names the changed fields on mission.updated only when the commander asked to notify', async () => {
      const published: MissionEvent[] = [];
      const publish = ctx.realtime.publish.bind(ctx.realtime);
      ctx.realtime.publish = ((event: MissionEvent) => {
        published.push(event);
        publish(event);
      }) as typeof ctx.realtime.publish;
      try {
        expect((await edit(flagged)).statusCode).toBe(200);
        expect((await edit({ ...details, name: 'שם חדש' })).statusCode).toBe(200);
      } finally {
        ctx.realtime.publish = publish;
      }
      const updates = published.filter((event) => event.type === 'mission.updated');
      expect(updates).toHaveLength(2);
      expect(updates[0]).toMatchObject({ changedFields: allFields });
      expect(updates[1]).not.toHaveProperty('changedFields');
    });

    it.each([undefined, false])('records and sends nothing when notifySearchers is %s', async (notifySearchers) => {
      await searcherWithToken(1);
      ctx.pushSender.sent.length = 0;
      const res = await edit({ ...details, notifySearchers });
      expect(res.statusCode).toBe(200);
      expect((await current()).name).toBe('מסע 0412');
      await settle();
      expect((await timelineOf()).map((event) => event.type)).toEqual(['mission.created', 'lkp.changed']);
      expect(ctx.pushSender.sent).toEqual([]);
    });

    it('records an empty change when the commander asked but nothing changed', async () => {
      await searcherWithToken(1);
      ctx.pushSender.sent.length = 0;
      const same = {
        name: 'מסע',
        missingPerson: { name: 'נועם אברהם', age: 74, description: 'מעיל חום' },
        notifySearchers: true,
      };
      expect((await edit(same)).statusCode).toBe(200);
      expect((await changesOf())[0]).toMatchObject({ details: { fields: [] } });
      await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
      expect(ctx.pushSender.sent[0]).toEqual(pushOf('פרטי המסע והנעדר עודכנו'));
    });

    it('does not count the same disappearance time in another offset as a change', async () => {
      expect((await edit(details)).statusCode).toBe(200);
      const sameInstant = {
        ...flagged,
        missingPerson: { ...details.missingPerson, disappearedAt: '2026-10-03T08:20:00Z' },
      };
      expect((await edit(sameInstant)).statusCode).toBe(200);
      expect((await changesOf())[0]).toMatchObject({ details: { fields: [] } });
    });

    it('names the new mission name on the event', async () => {
      expect((await edit({ ...flagged, name: 'מסע 0413' })).statusCode).toBe(200);
      expect((await changesOf())[0]?.subject.label).toBe('מסע 0413');
    });

    it('notifies on a paused mission too', async () => {
      await searcherWithToken(1);
      ctx.pushSender.sent.length = 0;
      await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
      expect((await edit(flagged)).statusCode).toBe(200);
      expect(await changesOf()).toHaveLength(1);
      await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
    });

    it.each(['ended_located', 'ended_stopped'] as const)(
      'records and sends nothing for a mission that is %s',
      async (status) => {
        await searcherWithToken(1);
        ctx.pushSender.sent.length = 0;
        await ctx.db.update(missions).set({ status }).where(eq(missions.id, missionId));
        const before = await current();
        const res = await edit(flagged);
        expect(res.statusCode).toBe(409);
        expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
        await settle();
        expect(await changesOf()).toEqual([]);
        expect(ctx.pushSender.sent).toEqual([]);
        expect(await current()).toEqual(before);
      },
    );

    it('records and sends nothing when the request is refused or invalid', async () => {
      const searcher = await searcherWithToken(1);
      const other = await signInCommander(ctx);
      ctx.pushSender.sent.length = 0;
      expect((await edit(flagged, injectAs(ctx, searcher))).statusCode).toBe(403);
      expect((await edit(flagged, injectAs(ctx, other))).statusCode).toBe(404);
      const anonymous = await ctx.app.inject({
        method: 'PUT',
        url: `/api/missions/${missionId}/details`,
        payload: flagged,
      });
      expect(anonymous.statusCode).toBe(401);
      const invalid = await edit({ ...details, notifySearchers: 'yes' });
      expect(invalid.statusCode).toBe(400);
      expect(ApiError.parse(invalid.json()).error.code).toBe('VALIDATION_ERROR');
      await settle();
      expect(await changesOf()).toEqual([]);
      expect(ctx.pushSender.sent).toEqual([]);
      expect((await current()).name).toBe('מסע');
    });

    it('pushes the active searchers of this mission only', async () => {
      const [first, second, ended, elsewhere] = [
        'ExponentPushToken[a]',
        'ExponentPushToken[b]',
        'ExponentPushToken[c]',
        'ExponentPushToken[d]',
      ];
      await searcherWithToken(1, missionId, first);
      const assigned = await searcherWithToken(2, missionId, second);
      const gone = await searcherWithToken(3, missionId, ended);
      const otherMission = Mission.parse(
        (
          await inject({
            method: 'POST',
            url: '/api/missions',
            payload: { name: 'אחר', rallyPoint, lkp },
          })
        ).json(),
      );
      await searcherWithToken(1, otherMission.id, elsewhere);
      await ctx.db
        .update(participations)
        .set({ status: 'ended' })
        .where(eq(participations.searcherId, gone.searcherId));
      await ctx.db
        .update(participations)
        .set({ status: 'assigned' })
        .where(eq(participations.searcherId, assigned.searcherId));
      ctx.pushSender.sent.length = 0;

      expect((await edit(flagged)).statusCode).toBe(200);
      await vi.waitFor(() => expect(ctx.pushSender.sent.length).toBeGreaterThan(0));
      await settle();
      const tokens = ctx.pushSender.sent.flatMap((entry) => entry.tokens);
      expect(tokens.sort()).toEqual([first, second]);
    });

    it('records the change when no searcher can be reached', async () => {
      expect((await edit(flagged)).statusCode).toBe(200);
      expect(await changesOf()).toHaveLength(1);
      await settle();
      expect(ctx.pushSender.sent).toEqual([]);
    });

    it('saves and records the change even when the push fails', async () => {
      await searcherWithToken(1);
      ctx.pushSender.sent.length = 0;
      ctx.pushSender.failNext(new Error('expo down'));
      expect((await edit(flagged)).statusCode).toBe(200);
      expect(await changesOf()).toHaveLength(1);
      expect((await current()).name).toBe('מסע 0412');
    });
  });
});
