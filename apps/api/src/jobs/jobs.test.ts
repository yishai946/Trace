import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
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
      async (job) => {
        seen.push(job);
        return 'escalated';
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
});
