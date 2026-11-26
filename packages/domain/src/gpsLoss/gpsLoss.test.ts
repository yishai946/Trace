import { describe, expect, it } from 'vitest';
import { gpsLossEscalationDue } from '.';

const since = new Date('2026-10-03T13:00:00Z');
const afterMs = 5 * 60_000;

describe('gpsLossEscalationDue', () => {
  it('is not due before the injected time has passed', () => {
    expect(gpsLossEscalationDue({ since, now: new Date(since.getTime() + afterMs - 1), afterMs })).toBe(false);
  });

  it('is due once the injected time has passed', () => {
    expect(gpsLossEscalationDue({ since, now: new Date(since.getTime() + afterMs), afterMs })).toBe(true);
    expect(gpsLossEscalationDue({ since, now: new Date(since.getTime() + afterMs * 3), afterMs })).toBe(true);
  });

  it('is never due while the GPS works', () => {
    expect(gpsLossEscalationDue({ since: null, now: new Date(since.getTime() + afterMs * 3), afterMs })).toBe(false);
  });
});
