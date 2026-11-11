import { describe, expect, it } from 'vitest';
import { toE164 } from '.';

describe('toE164', () => {
  it('turns an Israeli mobile number into an international one', () => {
    expect(toE164('050-123 4567')).toBe('+972501234567');
    expect(toE164('(052) 340-1187')).toBe('+972523401187');
    expect(toE164('972541234567')).toBe('+972541234567');
  });

  it('keeps an international number', () => {
    expect(toE164('+972541234567')).toBe('+972541234567');
    expect(toE164('+14155550123')).toBe('+14155550123');
  });

  it('rejects what is not a mobile or international number', () => {
    for (const input of ['', '0501234', '02-1234567', '+972', '05012345678', 'abc']) {
      expect(toE164(input), input).toBeNull();
    }
  });
});
