import { describe, expect, it } from 'vitest';
import { monitoringDefaults, shouldReportError, shouldReportStatus } from './sampling';

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

describe('shouldReportError', () => {
  const apiError = (status: number, code = 'X') => Object.assign(new Error('failed'), { status, code });

  it('reports server errors and errors that are not API answers', () => {
    expect(shouldReportError(apiError(500, 'INTERNAL_ERROR'))).toBe(true);
    expect(shouldReportError(new SyntaxError('response does not match its schema'))).toBe(true);
    expect(shouldReportError('boom')).toBe(true);
  });

  it('skips 4xx answers and being offline', () => {
    expect([401, 404, 409].map((status) => shouldReportError(apiError(status)))).toEqual([false, false, false]);
    expect(shouldReportError(apiError(0, 'NETWORK_ERROR'))).toBe(false);
  });
});
