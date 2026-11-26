import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import postgres from 'postgres';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { GpsLossJob } from '../modules/gpsLoss';
import { TEST_DATABASE_URL } from '../testing/testing.config';
import { createJobs } from '.';

describe('jobs on pg-boss', () => {
  const jobs = createJobs(TEST_DATABASE_URL);
  afterAll(() => jobs.stop());

  it('runs a scheduled GPS-loss check after its delay, once', async () => {
    const seen: GpsLossJob[] = [];
    await jobs.start(
      {
        escalate: async (job) => {
          seen.push(job);
          return 'escalated';
        },
      },
      { error: vi.fn() } as unknown as FastifyBaseLogger,
    );
    const job = { participationId: randomUUID(), since: new Date().toISOString() };
    await jobs.scheduler.schedule(job, 1);
    await jobs.scheduler.schedule(job, 1);
    expect(seen).toEqual([]);
    await vi.waitFor(() => expect(seen).toEqual([job]), { timeout: 15_000, interval: 250 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(seen).toHaveLength(1);
  }, 30_000);

  it('schedules the lost-contact scan every minute', async () => {
    const clearSchedule = async () => {
      const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
      try {
        await sql`delete from pgboss.schedule where name = 'lost-contact-alert'`;
      } finally {
        await sql.end();
      }
    };
    const scheduled = async () => {
      const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
      try {
        const rows = await sql<{ name: string; cron: string }[]>`select name, cron from pgboss.schedule`;
        return rows.filter(({ name }) => name === 'lost-contact-alert').map(({ name, cron }) => ({ name, cron }));
      } finally {
        await sql.end();
      }
    };
    await clearSchedule();
    expect(await scheduled()).toEqual([]);
    const other = createJobs(TEST_DATABASE_URL);
    try {
      await other.start({ alertLostContact: async () => 0 }, { error: vi.fn() } as unknown as FastifyBaseLogger);
      expect(await scheduled()).toEqual([{ name: 'lost-contact-alert', cron: '* * * * *' }]);
    } finally {
      await other.stop();
    }
  }, 30_000);
});
