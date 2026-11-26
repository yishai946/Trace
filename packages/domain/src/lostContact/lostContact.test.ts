import { describe, expect, it } from 'vitest';
import { lostContactAlertDue } from '.';

const AFTER_MS = 300_000;
const last = new Date('2026-10-03T13:00:00.000Z');
const at = (ms: number) => new Date(last.getTime() + ms);

describe('lostContactAlertDue', () => {
  it('is due once the injected time has passed since the last update', () => {
    expect(lostContactAlertDue({ lastUpdateAt: last, now: at(AFTER_MS), afterMs: AFTER_MS })).toBe(true);
    expect(lostContactAlertDue({ lastUpdateAt: last, now: at(AFTER_MS + 1), afterMs: AFTER_MS })).toBe(true);
  });

  it('is not due before the time has passed', () => {
    expect(lostContactAlertDue({ lastUpdateAt: last, now: at(AFTER_MS - 1), afterMs: AFTER_MS })).toBe(false);
  });

  it('is not due for a searcher who never reported', () => {
    expect(lostContactAlertDue({ lastUpdateAt: null, now: at(AFTER_MS * 10), afterMs: AFTER_MS })).toBe(false);
  });
});
