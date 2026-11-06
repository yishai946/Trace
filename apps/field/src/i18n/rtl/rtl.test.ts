import { describe, expect, it } from 'vitest';
import { ltr, LRI, PDI } from '.';

describe('ltr', () => {
  it('isolates numbers and codes so they read left to right inside Hebrew text', () => {
    expect(ltr('052-340-1187')).toBe(`${LRI}052-340-1187${PDI}`);
    expect(`קוד ${ltr('K7-4Q2')}`).toBe(`קוד ⁦K7-4Q2⁩`);
  });

  it('accepts numbers', () => {
    expect(ltr(82)).toBe(`${LRI}82${PDI}`);
  });
});
