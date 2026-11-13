import { describe, expect, it } from 'vitest';
import {
  acceptsReports,
  canChangeReport,
  canSubmitReport,
  compareReportsNewestFirst,
  isCriticalReport,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  reportSummary,
} from '.';

describe('REPORT_TYPES', () => {
  it('has the five categories of decision 15, each with a label', () => {
    expect(REPORT_TYPES).toEqual(['finding', 'hazard', 'inaccessible', 'general', 'located']);
    for (const type of REPORT_TYPES) expect(REPORT_TYPE_LABELS[type]).toBeTruthy();
  });
});

describe('canSubmitReport', () => {
  it('takes reports while the mission is active or paused', () => {
    expect(canSubmitReport('active')).toBe(true);
    expect(canSubmitReport('paused')).toBe(true);
  });

  it('takes none once the mission has ended', () => {
    expect(canSubmitReport('ended_located')).toBe(false);
    expect(canSubmitReport('ended_stopped')).toBe(false);
  });
});

describe('acceptsReports', () => {
  it('refuses only a searcher who finished the activity', () => {
    expect(acceptsReports('available')).toBe(true);
    expect(acceptsReports('assigned')).toBe(true);
    expect(acceptsReports('ended')).toBe(false);
  });
});

describe('reportSummary', () => {
  it('joins the type label and the text', () => {
    expect(reportSummary({ type: 'hazard', text: 'מדרון חלק' })).toBe('מפגע, מדרון חלק');
  });
});

describe('REPORT_STATUS_LABELS', () => {
  it('names both statuses in Hebrew', () => {
    expect(REPORT_STATUS_LABELS).toEqual({ new: 'חדש', handled: 'טופל' });
  });
});

describe('canChangeReport', () => {
  it('lets reports change while the mission is active or paused', () => {
    expect(canChangeReport('active')).toBe(true);
    expect(canChangeReport('paused')).toBe(true);
  });

  it('makes the reports of an ended mission read-only', () => {
    expect(canChangeReport('ended_located')).toBe(false);
    expect(canChangeReport('ended_stopped')).toBe(false);
  });
});

describe('isCriticalReport', () => {
  it('is critical only for a located report that is still New', () => {
    expect(isCriticalReport({ type: 'located', status: 'new' })).toBe(true);
    expect(isCriticalReport({ type: 'located', status: 'handled' })).toBe(false);
    expect(isCriticalReport({ type: 'hazard', status: 'new' })).toBe(false);
  });
});

describe('compareReportsNewestFirst', () => {
  const at = (reportedAt: string, createdAt = reportedAt) => ({ reportedAt, createdAt });

  it('orders by the time it was sent, newest first', () => {
    const list = [at('2026-10-03T13:20:00Z'), at('2026-10-03T13:25:00Z')];
    expect([...list].sort(compareReportsNewestFirst)).toEqual([list[1], list[0]]);
  });

  it('breaks a tie by arrival, newest first', () => {
    const first = at('2026-10-03T13:20:00Z', '2026-10-03T13:21:00Z');
    const second = at('2026-10-03T13:20:00Z', '2026-10-03T13:22:00Z');
    expect([first, second].sort(compareReportsNewestFirst)).toEqual([second, first]);
  });

  it('keeps equal reports in their order', () => {
    const a = { ...at('2026-10-03T13:20:00Z'), id: 'a' };
    const b = { ...at('2026-10-03T13:20:00Z'), id: 'b' };
    expect(compareReportsNewestFirst(a, b)).toBe(0);
    expect([a, b].sort(compareReportsNewestFirst)).toEqual([a, b]);
  });
});
