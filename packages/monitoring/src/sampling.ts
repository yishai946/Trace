/** Sentry options shared by the three apps. Errors are always reported; only a small share of traces is. */
export function monitoringDefaults(environment: string) {
  return {
    sampleRate: 1,
    tracesSampleRate: environment === 'production' ? 0.05 : 0,
    maxBreadcrumbs: 30,
    sendDefaultPii: false,
  };
}

/** A failed request is an error report only when the server failed; 4xx answers are expected outcomes. */
export const shouldReportStatus = (status: number) => status >= 500;

/**
 * Whether a failed query or mutation is reported. An API error (it carries the HTTP `status`) only when the server
 * failed; offline (`NETWORK_ERROR`, status 0) and 4xx are expected. Anything else, such as a response that does not
 * match its schema, is a bug in the app.
 */
export function shouldReportError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return true;
  if ('code' in error && error.code === 'NETWORK_ERROR') return false;
  if ('status' in error && typeof error.status === 'number') return shouldReportStatus(error.status);
  return true;
}
