import { describe, expect, it } from 'vitest';
import { canReportSighting, isLkpCandidate } from '.';

const lkpAt = new Date('2026-10-03T10:05:00Z');
const undecided = (observedAt: Date) => ({ observedAt, lkpDecision: null });

describe('isLkpCandidate', () => {
  it('suggests a sighting later than the LKP', () => {
    expect(isLkpCandidate(undecided(new Date('2026-10-03T11:22:00Z')), lkpAt)).toBe(true);
  });

  it('does not suggest an earlier sighting', () => {
    expect(isLkpCandidate(undecided(new Date('2026-10-03T09:00:00Z')), lkpAt)).toBe(false);
  });

  it('does not suggest a sighting seen at the same instant', () => {
    expect(isLkpCandidate(undecided(new Date('2026-10-03T10:05:00Z')), lkpAt)).toBe(false);
  });

  it('compares instants, not the offsets they were written with', () => {
    const lkp = new Date('2026-10-03T13:05:00+03:00');
    expect(isLkpCandidate(undecided(new Date('2026-10-03T10:05:00Z')), lkp)).toBe(false);
    expect(isLkpCandidate(undecided(new Date('2026-10-03T10:06:00Z')), lkp)).toBe(true);
  });

  it('does not suggest a decided sighting, even when later', () => {
    const later = new Date('2026-10-03T11:22:00Z');
    expect(isLkpCandidate({ observedAt: later, lkpDecision: 'accepted' }, lkpAt)).toBe(false);
    expect(isLkpCandidate({ observedAt: later, lkpDecision: 'rejected' }, lkpAt)).toBe(false);
  });

  it('suggests any undecided sighting when there is no LKP yet', () => {
    expect(isLkpCandidate(undecided(new Date('2020-01-01T00:00:00Z')), null)).toBe(true);
  });
});

describe('canReportSighting', () => {
  it.each(['available', 'assigned'] as const)('lets a %s searcher report', (status) => {
    expect(canReportSighting(status)).toBe(true);
  });

  it('refuses a searcher whose participation ended', () => {
    expect(canReportSighting('ended')).toBe(false);
  });
});
