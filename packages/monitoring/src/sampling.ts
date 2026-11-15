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
