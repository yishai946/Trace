import { buildApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';

const env = loadEnv();
const database = createDb(env.DATABASE_URL);
const app = await buildApp({ env, db: database.db });

const shutdown = async () => {
  await app.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal(error);
  process.exit(1);
}
