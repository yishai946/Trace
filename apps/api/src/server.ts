import { buildApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';
import { createJobs } from './jobs';
import { escalateGpsLoss } from './modules/gpsLoss';
import { alertLostContact } from './modules/lostContact';
import { flushMonitoring, reportError } from './monitoring';

const env = loadEnv();
const database = createDb(env.DATABASE_URL);
const jobs = createJobs(env.DATABASE_URL);
const { app, deps } = await buildApp({
  env,
  db: database.db,
  connectivityCheckMs: 30_000,
  gpsLossScheduler: env.GPS_LOST_ESCALATION_SECONDS ? jobs.scheduler : undefined,
});

const shutdown = async () => {
  await app.close();
  await jobs.stop();
  await database.close();
  await flushMonitoring();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  if (env.GPS_LOST_ESCALATION_SECONDS || env.LOST_CONTACT_AFTER_SECONDS) {
    await jobs.start(
      {
        escalate: env.GPS_LOST_ESCALATION_SECONDS ? (job) => escalateGpsLoss(deps, job) : undefined,
        alertLostContact: env.LOST_CONTACT_AFTER_SECONDS ? () => alertLostContact(deps) : undefined,
      },
      app.log,
    );
  }
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal(error);
  reportError(error, { requestId: 'startup' });
  await flushMonitoring();
  process.exit(1);
}
