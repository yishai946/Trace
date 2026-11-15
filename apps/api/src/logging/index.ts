import {
  LogController,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
  type LogLevel,
} from 'fastify';
import { SENSITIVE_KEYS } from '@trace/monitoring';
import type { Env } from '../env';

/** Where log lines go; Fastify writes to stdout when none is given. */
export interface LogStream {
  write(line: string): void;
}

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

declare module 'fastify' {
  interface FastifyContextConfig {
    /** The level of this route's `request completed` line. Routes called very often (health, GPS) use `debug`. */
    requestLogLevel?: LogLevel;
  }
}

/** `info` in production, `debug` locally, nothing in tests. `LOG_LEVEL` overrides it. */
export function defaultLogLevel(nodeEnv: 'development' | 'test' | 'production'): (typeof LOG_LEVELS)[number] {
  if (nodeEnv === 'production') return 'info';
  if (nodeEnv === 'test') return 'silent';
  return 'debug';
}

/**
 * Fields that never reach the log (`SENSITIVE_KEYS` of `@trace/monitoring`, the list the error reports use too). Pino
 * replaces them with `[Redacted]`, at the top level of a log object and one level down.
 */
const accessor = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `["${key}"]`);
export const REDACT_PATHS = [
  ...SENSITIVE_KEYS.flatMap((key) => [accessor(key).replace(/^\./, ''), `*${accessor(key)}`]),
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

/**
 * One `request completed` line per request instead of Fastify's two (`incoming request` and `request completed`), at
 * `info` or the route's `requestLogLevel`. Failures are logged at `error` by the error handler, not here.
 */
class RequestLogController extends LogController {
  override incomingRequest() {}

  override requestCompleted(_error: Error | null | undefined, request: FastifyRequest, reply: FastifyReply) {
    const level = request.routeOptions.config.requestLogLevel ?? 'info';
    request.log[level](
      { req: request, statusCode: reply.statusCode, responseTime: reply.elapsedTime },
      'request completed',
    );
  }
}

/** Fastify's logging: level from the environment, sensitive fields censored. Tests pass a stream to read the log. */
export function serverLogOptions(env: Env, stream?: LogStream): Pick<FastifyServerOptions, 'logger' | 'logController'> {
  return {
    logger: { level: env.LOG_LEVEL, redact: REDACT_PATHS, ...(stream ? { stream } : {}) },
    logController: new RequestLogController(),
  };
}
