import * as Sentry from '@sentry/node';
import { monitoringDefaults, scrubEvent } from '@trace/monitoring';
import type { Env } from '../env';
import { VERSION } from '../version';

type Transport = Sentry.NodeOptions['transport'];

/** Sentry's options for this environment, or null when no DSN is set (error tracking is then off). */
export function sentryOptions(env: Env, transport?: Transport): Sentry.NodeOptions | null {
  if (!env.SENTRY_DSN) return null;
  const defaults = monitoringDefaults(env.SENTRY_ENVIRONMENT);
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    release: env.SENTRY_RELEASE ?? `trace-api@${VERSION}`,
    ...defaults,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE ?? defaults.tracesSampleRate,
    // The error handler reports failures itself, with the request id; Sentry's own Fastify capture would send each twice.
    integrations: [Sentry.fastifyIntegration({ shouldHandleError: () => false })],
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubEvent,
    ...(transport ? { transport } : {}),
  };
}

/** Starts Sentry when a DSN is set. Returns whether it started. Tests pass a transport that sends nothing. */
export function initMonitoring(env: Env, transport?: Transport): boolean {
  const options = sentryOptions(env, transport);
  if (!options) return false;
  Sentry.init(options);
  return true;
}

/** Where a reported error came from: the request whose log lines hold it, and the part of the API that failed. */
export interface ErrorContext {
  requestId?: string;
  /** For example `realtime.join` or `push.send`, for errors that no HTTP request answers. */
  source?: string;
}

/** Reports an unexpected error, tagged so its log lines can be found. A no-op when off. */
export function reportError(error: unknown, { requestId, source }: ErrorContext) {
  const tags = { ...(requestId ? { request_id: requestId } : {}), ...(source ? { source } : {}) };
  Sentry.captureException(error, { tags });
}

/** The part of a pino logger that `logAndReport` writes to. */
interface ErrorLogger {
  error(fields: Record<string, unknown>, message: string): void;
}

/**
 * Logs an unexpected failure that is handled without throwing (realtime handlers, push sending) and reports it, so it
 * reaches Sentry and not only the logs. Expected outcomes (a refused request, a dead push token) are not passed here.
 */
export function logAndReport(
  log: ErrorLogger,
  error: unknown,
  { source, message, fields = {} }: { source: string; message: string; fields?: Record<string, unknown> },
) {
  log.error({ err: error, ...fields }, message);
  reportError(error, { source });
}

/** Waits for queued events to be sent; call before the process exits. */
export async function flushMonitoring(timeoutMs = 2000) {
  await Sentry.flush(timeoutMs);
}
