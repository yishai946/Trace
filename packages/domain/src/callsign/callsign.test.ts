import { describe, expect, it } from 'vitest';
import { formatCallsign, nextCallsign } from '.';

describe('formatCallsign', () => {
  it('pads single digits with a leading zero', () => {
    expect(formatCallsign(7)).toBe('07');
    expect(formatCallsign(0)).toBe('00');
  });

  it('keeps two-digit callsigns as they are', () => {
    expect(formatCallsign(21)).toBe('21');
  });

  it('rejects values outside 0-99', () => {
    expect(() => formatCallsign(100)).toThrow(RangeError);
    expect(() => formatCallsign(-1)).toThrow(RangeError);
    expect(() => formatCallsign(3.5)).toThrow(RangeError);
  });
});

describe('nextCallsign', () => {
  it('starts at 01 and fills the lowest gap', () => {
    expect(nextCallsign([])).toBe(1);
    expect(nextCallsign([1, 2, 4])).toBe(3);
    expect(nextCallsign([0, 2])).toBe(1);
  });

  it('is null once 01 to 99 are taken', () => {
    expect(nextCallsign(Array.from({ length: 99 }, (_, i) => i + 1))).toBeNull();
  });
});
