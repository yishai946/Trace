import { describe, expect, it } from 'vitest';
import { nextPolygonLetter, polygonLetter } from '.';

describe('polygonLetter', () => {
  it('counts A to Z, then two letters', () => {
    expect(polygonLetter(0)).toBe('A');
    expect(polygonLetter(25)).toBe('Z');
    expect(polygonLetter(26)).toBe('AA');
    expect(polygonLetter(27)).toBe('AB');
    expect(polygonLetter(52)).toBe('BA');
  });

  it('rejects invalid indexes', () => {
    expect(() => polygonLetter(-1)).toThrow(RangeError);
    expect(() => polygonLetter(1.5)).toThrow(RangeError);
  });
});

describe('nextPolygonLetter', () => {
  it('starts at A', () => {
    expect(nextPolygonLetter([])).toBe('A');
  });

  it('fills the first gap and never reuses a taken letter', () => {
    expect(nextPolygonLetter(['A', 'B', 'D'])).toBe('C');
    expect(nextPolygonLetter(['A', 'B', 'C'])).toBe('D');
  });
});
