import * as Sentry from '@sentry/react-native';
import { shouldReportError } from '@trace/monitoring';
import { sentryOptions } from './options';

/**
 * Starts Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set; returns whether it started. The variables are read by their
 * literal names because Expo inlines `process.env.EXPO_PUBLIC_*` at build time.
 */
export function initMonitoring(): boolean {
  const environment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || (__DEV__ ? 'development' : 'production');
  const options = sentryOptions(process.env.EXPO_PUBLIC_SENTRY_DSN, environment);
  if (!options) return false;
  Sentry.init(options);
  return true;
}

/** Reports a failed query or mutation that is a server failure or a bug; offline and 4xx answers are not. */
export function reportQueryError(error: unknown) {
  if (shouldReportError(error)) Sentry.captureException(error);
}
