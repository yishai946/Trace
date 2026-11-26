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
import { escalateGpsLoss } from './gpsLoss.service';

const AFTER_SECONDS = 300;

describe('GPS loss escalation (UC-S04, decision 42)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let missionId: string;
  let participationId: string;
  let searcher: Awaited<ReturnType<typeof signInSearcher>>;

  beforeAll(async () => {
    ctx = await createTestApp({ GPS_LOST_ESCALATION_SECONDS: String(AFTER_SECONDS) });
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    ctx.gpsLossJobs.length = 0;
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
    searcher = await signInSearcher(ctx);
    participationId = await addParticipant(ctx.db, { missionId, callsign: 7, searcherId: searcher.searcherId });
  });
  afterAll(() => ctx.close());

  const setGps = (available: boolean) =>
    injectAs(
      ctx,
      searcher,
    )({ method: 'PUT', url: `/api/missions/${missionId}/participation/gps`, payload: { available } });
  const timeline = async () =>
    TimelineEventList.parse((await commander({ method: 'GET', url: `/api/missions/${missionId}/timeline` })).json());
  const afterLoss = (extraMs: number, since: string) => new Date(Date.parse(since) + AFTER_SECONDS * 1000 + extraMs);

  it('schedules one escalation when the GPS is lost, and none for a repeated report', async () => {
    await setGps(false);
    await setGps(false);
    expect(ctx.gpsLossJobs).toHaveLength(1);
    expect(ctx.gpsLossJobs[0]).toMatchObject({ job: { participationId }, afterSeconds: AFTER_SECONDS });
  });

  it('escalates once to the commander when the GPS is still lost after the injected time', async () => {
    await setGps(false);
    const job = ctx.gpsLossJobs[0]!.job;
    const published: MissionEvent[] = [];
    vi.spyOn(ctx.realtime, 'publish').mockImplementation((event) => void published.push(event));

    await escalateGpsLoss(ctx.deps, job, afterLoss(0, job.since));
    await escalateGpsLoss(ctx.deps, job, afterLoss(1000, job.since));

    const events = (await timeline()).filter((e) => e.type === 'gps.lost_escalated');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actor: { kind: 'system' },
      subject: { kind: 'participant', id: participationId, callsign: 7 },
      details: { since: job.since },
    });
    expect(published.filter((e) => e.type === 'timeline.recorded')).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('does not escalate before the injected time has passed', async () => {
    await setGps(false);
    const job = ctx.gpsLossJobs[0]!.job;
    await expect(escalateGpsLoss(ctx.deps, job, afterLoss(-1, job.since))).resolves.toBe('early');
    expect((await timeline()).some((e) => e.type === 'gps.lost_escalated')).toBe(false);
  });

  it('does not escalate when the GPS came back, or was lost again later', async () => {
    await setGps(false);
    const first = ctx.gpsLossJobs[0]!.job;
    await setGps(true);
    await expect(escalateGpsLoss(ctx.deps, first, afterLoss(0, first.since))).resolves.toBe('stale');

    await new Promise((resolve) => setTimeout(resolve, 5));
    await setGps(false);
    await expect(escalateGpsLoss(ctx.deps, first, afterLoss(10_000, first.since))).resolves.toBe('stale');
    expect((await timeline()).some((e) => e.type === 'gps.lost_escalated')).toBe(false);
  });

  it('does not escalate for a searcher whose activity ended or a mission that ended', async () => {
    await setGps(false);
    const job = ctx.gpsLossJobs[0]!.job;
    await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, missionId));
    await expect(escalateGpsLoss(ctx.deps, job, afterLoss(0, job.since))).resolves.toBe('stale');
    await ctx.db.update(missions).set({ status: 'active' }).where(eq(missions.id, missionId));
    await ctx.db.update(participations).set({ status: 'ended' }).where(eq(participations.id, participationId));
    await expect(escalateGpsLoss(ctx.deps, job, afterLoss(0, job.since))).resolves.toBe('stale');
  });

  it('schedules nothing when no escalation time is configured', async () => {
    const plain = await createTestApp();
    try {
      await resetDb(plain.db);
      const user = await signInCommander(plain);
      const created = await injectAs(
        plain,
        user,
      )({
        method: 'POST',
        url: '/api/missions',
        payload: {
          name: 'מסע',
          rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
          lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
        },
      });
      const id = Mission.parse(created.json()).id;
      const who = await signInSearcher(plain);
      await addParticipant(plain.db, { missionId: id, callsign: 3, searcherId: who.searcherId });
      await injectAs(
        plain,
        who,
      )({ method: 'PUT', url: `/api/missions/${id}/participation/gps`, payload: { available: false } });
      expect(plain.gpsLossJobs).toHaveLength(0);
    } finally {
      await plain.close();
    }
  });
});
