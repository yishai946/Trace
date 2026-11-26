import { PgBoss } from 'pg-boss';
import type { FastifyBaseLogger } from 'fastify';
import type { GpsLossJob, GpsLossOutcome, GpsLossScheduler } from '../modules/gpsLoss';

/** The queue of delayed GPS-loss checks (UC-S04, decision 42). */
const GPS_LOSS_QUEUE = 'gps-loss-escalation';

/** The recurring scan for searchers who sent no update (UC-S04, decision 44). */
const LOST_CONTACT_QUEUE = 'lost-contact-alert';

/** How often the scan runs: every minute, so an alert is at most a minute late. */
const LOST_CONTACT_CRON = '* * * * *';

/** A check that ran before its time passed is tried again, a few times, a few seconds apart. */
const RETRY = { retryLimit: 5, retryDelay: 5 } as const;

export interface JobHandlers {
  escalate?: (job: GpsLossJob) => Promise<GpsLossOutcome>;
  alertLostContact?: () => Promise<unknown>;
}

export interface Jobs {
  scheduler: GpsLossScheduler;
  /**
   * Starts pg-boss on the database and begins running the jobs it is given: GPS-loss checks with `escalate`, and the
   * recurring scan with `alertLostContact`. A job that is not given is not queued.
   */
  start(handlers: JobHandlers, log: FastifyBaseLogger): Promise<void>;
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
    async start({ escalate, alertLostContact }, log) {
      boss.on('error', (err) => log.error({ err }, 'job queue error'));
      await boss.start();
      started = true;
      if (escalate) {
        await boss.createQueue(GPS_LOSS_QUEUE);
        await boss.work<GpsLossJob>(GPS_LOSS_QUEUE, async (jobs) => {
          for (const { data } of jobs) {
            // "early" throws so pg-boss runs the job again; any other outcome is final.
            if ((await escalate(data)) === 'early') throw new Error('GPS loss escalation ran before its time');
          }
        });
      }
      if (alertLostContact) {
        await boss.createQueue(LOST_CONTACT_QUEUE);
        await boss.schedule(LOST_CONTACT_QUEUE, LOST_CONTACT_CRON);
        await boss.work(LOST_CONTACT_QUEUE, async () => {
          await alertLostContact();
        });
      }
    },
    stop: async () => {
      if (started) await boss.stop({ graceful: true, timeout: 5000 });
    },
  };
}
