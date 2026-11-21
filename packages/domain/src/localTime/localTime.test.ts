import { describe, expect, it } from 'vitest';
import { clockOf, localDateTimeOf, padNumber } from './index';

describe('padNumber', () => {
  it('pads to two digits by default', () => {
    expect(padNumber(7)).toBe('07');
    expect(padNumber(42)).toBe('42');
  });

  it('pads to the given length', () => {
    expect(padNumber(5, 4)).toBe('0005');
  });
});

describe('clockOf', () => {
  it('gives HH:MM in local time', () => {
    expect(clockOf(new Date(2026, 0, 5, 4, 9))).toBe('04:09');
    expect(clockOf(new Date(2026, 11, 31, 23, 59))).toBe('23:59');
  });
});

describe('localDateTimeOf', () => {
  it('gives YYYY-MM-DDTHH:mm in local time', () => {
    expect(localDateTimeOf(new Date(2026, 0, 5, 4, 9))).toBe('2026-01-05T04:09');
  });

  it('pads the year to four digits', () => {
    const date = new Date(2026, 0, 1, 0, 0);
    date.setFullYear(99);
    expect(localDateTimeOf(date)).toBe('0099-01-01T00:00');
  });
});
