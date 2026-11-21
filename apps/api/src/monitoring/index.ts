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

/** Reports an unexpected error, tagged with the request id so its log lines can be found. A no-op when off. */
export function reportError(error: unknown, { requestId }: { requestId: string }) {
  Sentry.captureException(error, { tags: { request_id: requestId } });
}

/** Waits for queued events to be sent; call before the process exits. */
export async function flushMonitoring(timeoutMs = 2000) {
  await Sentry.flush(timeoutMs);
}
