import { z } from 'zod';
import { defaultLogLevel, LOG_LEVELS } from '../logging';

/** The database from docker-compose.yml. Every other environment sets DATABASE_URL. */
export const LOCAL_DATABASE_URL = 'postgres://trace:trace@localhost:5433/trace';

/** Signs session cookies outside production only. Production must set its own AUTH_SECRET. */
const DEV_AUTH_SECRET = 'trace-development-secret-not-for-production-use';

/** A variable left blank in a `.env` file counts as unset. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const EnvInput = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  /** Defaults by NODE_ENV: `info` in production, `debug` in development, `silent` in tests. */
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).default(LOCAL_DATABASE_URL),
  /** The address clients reach the API at; Better Auth builds its callback URLs from it. */
  API_URL: z.url().default('http://localhost:3001'),
  AUTH_SECRET: z.string().min(32).default(DEV_AUTH_SECRET),
  /** Expo's access token for enhanced push security. Optional: push is sent without it when unset. */
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  /**
   * Set to `true` behind a reverse proxy (Railway) so the client address is read from `X-Forwarded-For`. Off by default:
   * without a proxy the header comes from the client and anyone could forge it.
   */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Error tracking is off without a DSN. */
  SENTRY_DSN: optional(z.url()),
  /** Defaults to NODE_ENV. */
  SENTRY_ENVIRONMENT: optional(z.string().min(1)),
  /** Defaults to `trace-api@<package version>`. */
  SENTRY_RELEASE: optional(z.string().min(1)),
  /** Share of requests traced, 0 to 1. Defaults to 0.05 in production and 0 elsewhere. */
  SENTRY_TRACES_SAMPLE_RATE: optional(z.coerce.number().min(0).max(1)),
  /** Grafana Cloud Loki: the push host, the user (instance id) and a token that may only write logs. All or none. */
  LOKI_URL: optional(z.url()),
  LOKI_USER: optional(z.string().min(1)),
  LOKI_TOKEN: optional(z.string().min(1)),
});

const LOKI_VARIABLES = ['LOKI_URL', 'LOKI_USER', 'LOKI_TOKEN'] as const;

const Env = EnvInput.superRefine((env, ctx) => {
  const missing = LOKI_VARIABLES.filter((name) => !env[name]);
  if (missing.length === 0 || missing.length === LOKI_VARIABLES.length) return;
  ctx.addIssue({
    code: 'custom',
    message: `Set all of ${LOKI_VARIABLES.join(', ')} or none; missing ${missing.join(', ')}`,
  });
}).transform((env) => ({
  ...env,
  LOG_LEVEL: env.LOG_LEVEL ?? defaultLogLevel(env.NODE_ENV),
  SENTRY_ENVIRONMENT: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
}));

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
