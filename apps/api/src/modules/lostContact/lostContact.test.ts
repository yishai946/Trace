import { Mission, TimelineEventList, type MissionEvent } from '@trace/schemas';
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
} from '../../testing';
import { alertLostContact } from './lostContact.service';

const AFTER_SECONDS = 300;
const LAST_UPDATE = new Date('2026-10-03T13:00:00.000Z');
const at = (ms: number) => new Date(LAST_UPDATE.getTime() + ms);

describe('lost contact alert (UC-S04, decision 44)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let missionId: string;
  let participationId: string;

  beforeAll(async () => {
    ctx = await createTestApp({ LOST_CONTACT_AFTER_SECONDS: String(AFTER_SECONDS) });
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = injectAs(ctx, await signInCommander(ctx));
    const created = await commander({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    missionId = Mission.parse(created.json()).id;
    const searcher = await signInSearcher(ctx);
    participationId = await addParticipant(ctx.db, { missionId, callsign: 7, searcherId: searcher.searcherId });
    await setLastPosition(LAST_UPDATE);
  });
  afterAll(() => ctx.close());

  const setLastPosition = (when: Date | null) =>
    ctx.db.update(participations).set({ lastPositionAt: when }).where(eq(participations.id, participationId));
  const alerts = async () =>
    TimelineEventList.parse(
      (await commander({ method: 'GET', url: `/api/missions/${missionId}/timeline` })).json(),
    ).filter((e) => e.type === 'contact.no_updates');

  it('alerts the commander once when the searcher has sent no update for the injected time', async () => {
    const published: MissionEvent[] = [];
    vi.spyOn(ctx.realtime, 'publish').mockImplementation((event) => void published.push(event));

    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000))).toBe(1);
    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000 + 60_000))).toBe(0);

    const events = await alerts();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actor: { kind: 'system' },
      subject: { kind: 'participant', id: participationId, callsign: 7 },
      details: { lastUpdateAt: LAST_UPDATE.toISOString() },
    });
    expect(published.filter((e) => e.type === 'timeline.recorded')).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('does not alert before the injected time has passed', async () => {
    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000 - 1))).toBe(0);
    expect(await alerts()).toHaveLength(0);
  });

  it('counts a battery report as an update', async () => {
    await ctx.db
      .update(participations)
      .set({ batteryMeasuredAt: at(240_000) })
      .where(eq(participations.id, participationId));
    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000))).toBe(0);
    expect(await alertLostContact(ctx.deps, at(240_000 + AFTER_SECONDS * 1000))).toBe(1);
  });

  it('alerts again for a new silence after the searcher reported in between', async () => {
    await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000));
    const later = at(3_600_000);
    await setLastPosition(later);
    expect(await alertLostContact(ctx.deps, new Date(later.getTime() + AFTER_SECONDS * 1000))).toBe(1);
    expect(await alerts()).toHaveLength(2);
  });

  it('does not alert for a searcher who never reported', async () => {
    await setLastPosition(null);
    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 10_000))).toBe(0);
  });

  it('does not alert for a searcher whose activity ended or a mission that ended', async () => {
    await ctx.db.update(participations).set({ status: 'ended' }).where(eq(participations.id, participationId));
    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000))).toBe(0);
    await ctx.db.update(participations).set({ status: 'available' }).where(eq(participations.id, participationId));
    await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, missionId));
    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000))).toBe(0);
    expect(await alerts()).toHaveLength(0);
  });

  it('alerts during a paused mission', async () => {
    await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
    expect(await alertLostContact(ctx.deps, at(AFTER_SECONDS * 1000))).toBe(1);
  });

  it('does nothing when no time is configured', async () => {
    const plain = await createTestApp();
    try {
      expect(await alertLostContact(plain.deps, at(AFTER_SECONDS * 10_000))).toBe(0);
    } finally {
      await plain.close();
    }
  });
});
