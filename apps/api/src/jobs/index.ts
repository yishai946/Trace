import { PgBoss } from 'pg-boss';
import type { FastifyBaseLogger } from 'fastify';
import type { GpsLossJob, GpsLossOutcome, GpsLossScheduler } from '../modules/gpsLoss';

/** The queue of delayed GPS-loss checks (UC-S04, decision 42). */
const GPS_LOSS_QUEUE = 'gps-loss-escalation';

/** A check that ran before its time passed is tried again, a few times, a few seconds apart. */
const RETRY = { retryLimit: 5, retryDelay: 5 } as const;

export interface Jobs {
  scheduler: GpsLossScheduler;
  /** Starts pg-boss on the database and begins running checks with `escalate`. */
  start(escalate: (job: GpsLossJob) => Promise<GpsLossOutcome>, log: FastifyBaseLogger): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Background jobs on Postgres with pg-boss (TECH_STACK.md), so a delayed check survives a restart and runs once even
 * with several API instances.
 */
export function createJobs(connectionString: string): Jobs {
  const boss = new PgBoss(connectionString);
  let started = false;
  return {
    scheduler: {
      async schedule(job, afterSeconds) {
        await boss.send(GPS_LOSS_QUEUE, job, {
          startAfter: afterSeconds,
          singletonKey: `${job.participationId}:${job.since}`,
          ...RETRY,
        });
      },
    },
    async start(escalate, log) {
      boss.on('error', (err) => log.error({ err }, 'job queue error'));
      await boss.start();
      started = true;
      await boss.createQueue(GPS_LOSS_QUEUE);
      await boss.work<GpsLossJob>(GPS_LOSS_QUEUE, async (jobs) => {
        for (const { data } of jobs) {
          // "early" throws so pg-boss runs the job again; any other outcome is final.
          if ((await escalate(data)) === 'early') throw new Error('GPS loss escalation ran before its time');
        }
      });
    },
    stop: async () => {
      if (started) await boss.stop({ graceful: true, timeout: 5000 });
    },
  };
}
