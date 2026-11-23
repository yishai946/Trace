import { OFFLINE_AFTER_MS } from '@trace/domain';
import { Mission, TimelineEventList, type MissionEvent, type TimelineEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { missions, participations } from '../../db/schema';
import { addParticipant, createTestApp, injectAs, resetDb, signInCommander, type TestContext } from '../../testing';
import { recordConnectivityChanges } from './timeline.connectivity';

const LKP_TIME = '2026-10-03T13:05:00+03:00';
const minutes = (n: number) => n * 60_000;

describe('timeline: searcher connectivity events (UC-C10)', () => {
  let ctx: TestContext;
  let missionId: string;
  let inject: ReturnType<typeof injectAs>;
  let connected: Set<string>;
  const publish = vi.fn<(event: MissionEvent) => void>();
  const realtime = {
    publish,
    connectedSearcherIds: async () => connected as ReadonlySet<string>,
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    publish.mockClear();
    connected = new Set();
    const commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    const res = await inject({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע 0412',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: LKP_TIME },
      },
    });
    missionId = Mission.parse(res.json()).id;
  });

  const run = (now = new Date()) => recordConnectivityChanges({ db: ctx.db, realtime }, now);
  const timeline = async (): Promise<TimelineEvent[]> => {
    const res = await inject({ method: 'GET', url: `/api/missions/${missionId}/timeline` });
    return TimelineEventList.parse(res.json());
  };
  const connectivityEvents = async () =>
    (await timeline()).filter((e) => e.type === 'contact.lost' || e.type === 'contact.restored');
  const setLastUpdate = (participationId: string, at: Date | null) =>
    ctx.db.update(participations).set({ lastPositionAt: at }).where(eq(participations.id, participationId));
  const searcher = async (callsign: number, lastUpdateAt: Date | null) => {
    const id = await addParticipant(ctx.db, { missionId, callsign, position: [35.13, 31.78] });
    await setLastUpdate(id, lastUpdateAt);
    return id;
  };
  const ago = (ms: number) => new Date(Date.now() - ms);

  it('records a searcher going Offline once, however often the check runs', async () => {
    const id = await searcher(7, ago(minutes(10)));

    expect(await run()).toBe(1);
    expect(await run()).toBe(0);

    const events = await connectivityEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'contact.lost',
      actor: { kind: 'system' },
      subject: { kind: 'participant', id, label: 'מחפש 7', callsign: 7 },
    });
  });

  it('records the return once the searcher reports again, and only once', async () => {
    const id = await searcher(7, ago(minutes(10)));
    await run();
    await setLastUpdate(id, new Date());

    expect(await run()).toBe(1);
    expect(await run()).toBe(0);

    const events = await connectivityEvents();
    expect(events.map((e) => e.type)).toEqual(['contact.lost', 'contact.restored']);
    expect(events[1]).toMatchObject({ subject: { id, callsign: 7 }, actor: { kind: 'system' } });
  });

  it('counts a live connection as online and as a return', async () => {
    const id = await searcher(7, ago(minutes(10)));
    await run();
    const [row] = await ctx.db
      .select({ searcherId: participations.searcherId })
      .from(participations)
      .where(eq(participations.id, id));
    connected = new Set([row?.searcherId ?? '']);

    expect(await run()).toBe(1);
    expect((await connectivityEvents()).map((e) => e.type)).toEqual(['contact.lost', 'contact.restored']);
  });

  it('records every Offline and return of a searcher who drops more than once', async () => {
    const id = await searcher(7, ago(minutes(10)));
    await run();
    await setLastUpdate(id, new Date());
    await run();
    await setLastUpdate(id, ago(OFFLINE_AFTER_MS + minutes(1)));
    await run();

    expect((await connectivityEvents()).map((e) => e.type)).toEqual([
      'contact.lost',
      'contact.restored',
      'contact.lost',
    ]);
  });

  it('records nothing for a searcher who is online, who never reported, or who left', async () => {
    await searcher(1, new Date());
    await searcher(2, null);
    const leftId = await addParticipant(ctx.db, { missionId, callsign: 3, status: 'ended' });
    await setLastUpdate(leftId, ago(minutes(30)));

    expect(await run()).toBe(0);
    expect(await connectivityEvents()).toEqual([]);
  });

  it('keeps each searcher apart', async () => {
    await searcher(1, new Date());
    const lost = await searcher(2, ago(minutes(10)));

    expect(await run()).toBe(1);
    expect((await connectivityEvents())[0]?.subject.id).toBe(lost);
  });

  it('skips a mission that has ended', async () => {
    await searcher(7, ago(minutes(10)));
    await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, missionId));

    expect(await run()).toBe(0);
    expect(await connectivityEvents()).toEqual([]);
  });

  it('tells the commander about each recorded event, after it is saved', async () => {
    await searcher(7, ago(minutes(10)));
    await run();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'timeline.recorded',
        missionId,
        event: expect.objectContaining({ type: 'contact.lost' }),
      }),
    );
    publish.mockClear();
    await run();
    expect(publish).not.toHaveBeenCalled();
  });
});
