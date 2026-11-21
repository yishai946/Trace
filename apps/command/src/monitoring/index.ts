import * as Sentry from '@sentry/react';
import { monitoringDefaults, scrubEvent, shouldReportError } from '@trace/monitoring';

/** The slice of `import.meta.env` that monitoring reads. */
export interface MonitoringEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  /** Vite's mode: `production` for a build, `development` for the dev server. */
  readonly MODE?: string;
}

/** Sentry's options, or null when no DSN is set (error tracking is then off). */
export function sentryOptions(env: MonitoringEnv): Sentry.BrowserOptions | null {
  const dsn = env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return null;
  const environment = env.VITE_SENTRY_ENVIRONMENT || env.MODE || 'development';
  return {
    dsn,
    environment,
    ...(env.VITE_SENTRY_RELEASE ? { release: env.VITE_SENTRY_RELEASE } : {}),
    ...monitoringDefaults(environment),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubEvent,
  };
}

/** Starts Sentry when a DSN is set. Returns whether it started. */
export function initMonitoring(env: MonitoringEnv = import.meta.env): boolean {
  const options = sentryOptions(env);
  if (!options) return false;
  Sentry.init(options);
  return true;
}

/** Reports a failed query or mutation that is a server failure or a bug; offline and 4xx answers are not. */
export function reportQueryError(error: unknown) {
  if (shouldReportError(error)) Sentry.captureException(error);
}
