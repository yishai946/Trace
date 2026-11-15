import type { ReactNativeOptions } from '@sentry/react-native';
import { monitoringDefaults, scrubEvent } from '@trace/monitoring';

/**
 * Sentry's options, or null when no DSN is set (error tracking is then off). The release is left to the SDK: it uses
 * the app's bundle id, version and build, which is what the EAS source map upload is keyed by.
 */
export function sentryOptions(dsn?: string, environment = 'production'): ReactNativeOptions | null {
  const trimmed = dsn?.trim();
  if (!trimmed) return null;
  return {
    dsn: trimmed,
    environment,
    ...monitoringDefaults(environment),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubEvent,
  };
}
