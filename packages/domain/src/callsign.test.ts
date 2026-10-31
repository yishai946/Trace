import { describe, expect, it } from 'vitest';
import { formatCallsign } from './callsign';

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
