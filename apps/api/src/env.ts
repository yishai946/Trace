import { z } from 'zod';

/** The database from docker-compose.yml. Every other environment sets DATABASE_URL. */
export const LOCAL_DATABASE_URL = 'postgres://trace:trace@localhost:5433/trace';

/** Signs session cookies outside production only. Production must set its own AUTH_SECRET. */
const DEV_AUTH_SECRET = 'trace-development-secret-not-for-production-use';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).default(LOCAL_DATABASE_URL),
  /** The address clients reach the API at; Better Auth builds its callback URLs from it. */
  API_URL: z.url().default('http://localhost:3001'),
  AUTH_SECRET: z.string().min(32).default(DEV_AUTH_SECRET),
});

export type Env = z.infer<typeof Env>;

/** Validates environment variables once at startup; a bad value stops the server with a clear message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = Env.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  if (result.data.NODE_ENV === 'production') {
    for (const name of ['DATABASE_URL', 'API_URL', 'AUTH_SECRET']) {
      if (!source[name]) throw new Error(`Invalid environment variables:\n${name} is required in production`);
    }
  }
  return result.data;
}
