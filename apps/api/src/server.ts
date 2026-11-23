import { buildApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';
import { flushMonitoring, reportError } from './monitoring';

const env = loadEnv();
const database = createDb(env.DATABASE_URL);
const { app } = await buildApp({ env, db: database.db, connectivityCheckMs: 30_000 });

const shutdown = async () => {
  await app.close();
  await database.close();
  await flushMonitoring();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal(error);
  reportError(error, { requestId: 'startup' });
  await flushMonitoring();
  process.exit(1);
}
