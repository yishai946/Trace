import { buildApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';
import { createJobs } from './jobs';
import { escalateGpsLoss } from './modules/gpsLoss';
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
  if (env.GPS_LOST_ESCALATION_SECONDS) await jobs.start((job) => escalateGpsLoss(deps, job), app.log);
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal(error);
  reportError(error, { requestId: 'startup' });
  await flushMonitoring();
  process.exit(1);
}
