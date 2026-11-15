import { describe, expect, it } from 'vitest';
import { monitoringDefaults, shouldReportStatus } from './sampling';

describe('monitoringDefaults', () => {
  it('reports every error and a small share of traces in production', () => {
    expect(monitoringDefaults('production')).toEqual({
      sampleRate: 1,
      tracesSampleRate: 0.05,
      maxBreadcrumbs: 30,
      sendDefaultPii: false,
    });
  });

  it('samples no traces elsewhere', () => {
    expect(monitoringDefaults('development').tracesSampleRate).toBe(0);
    expect(monitoringDefaults('staging').tracesSampleRate).toBe(0);
  });
});

describe('shouldReportStatus', () => {
  it('reports server failures only', () => {
    expect([500, 503].map(shouldReportStatus)).toEqual([true, true]);
    expect([400, 401, 404, 409].map(shouldReportStatus)).toEqual([false, false, false, false]);
  });
});
