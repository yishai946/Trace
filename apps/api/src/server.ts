import { buildApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = await buildApp(env);

const shutdown = async () => {
  await app.close();
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
