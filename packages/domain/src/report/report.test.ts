import { describe, expect, it } from 'vitest';
import { acceptsReports, canSubmitReport, REPORT_TYPE_LABELS, REPORT_TYPES, reportSummary } from '.';

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
