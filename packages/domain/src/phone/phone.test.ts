import { describe, expect, it } from 'vitest';
import { formatPhone } from '.';

describe('formatPhone', () => {
  it('writes an Israeli mobile number the local way', () => {
    expect(formatPhone('+972523401187')).toBe('052-340-1187');
  });

  it('keeps any other number as it is', () => {
    expect(formatPhone('+14155550123')).toBe('+14155550123');
  });
});
