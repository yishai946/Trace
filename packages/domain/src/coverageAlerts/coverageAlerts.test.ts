import { describe, expect, it } from 'vitest';
import { COVERAGE_ALERT_THRESHOLDS, newCoverageThresholds } from '.';

describe('newCoverageThresholds', () => {
  it('uses the fixed MVP thresholds (decision 55)', () => {
    expect(COVERAGE_ALERT_THRESHOLDS).toEqual([80, 90]);
  });

  it('is empty without a Coverage value or below 80', () => {
    expect(newCoverageThresholds(null, [])).toEqual([]);
    expect(newCoverageThresholds(79, [])).toEqual([]);
  });

  it('returns a threshold at exactly its value', () => {
    expect(newCoverageThresholds(80, [])).toEqual([80]);
    expect(newCoverageThresholds(89, [])).toEqual([80]);
    expect(newCoverageThresholds(90, [])).toEqual([80, 90]);
  });

  it('returns every threshold a jump passed, lowest first', () => {
    expect(newCoverageThresholds(100, [])).toEqual([80, 90]);
  });

  it('skips thresholds already raised, even when Coverage fell and rose again', () => {
    expect(newCoverageThresholds(85, [80])).toEqual([]);
    expect(newCoverageThresholds(95, [80])).toEqual([90]);
    expect(newCoverageThresholds(95, [80, 90])).toEqual([]);
  });
});
