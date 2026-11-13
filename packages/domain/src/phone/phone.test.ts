import { describe, expect, it } from 'vitest';
import { formatPhone, telHref } from '.';

describe('formatPhone', () => {
  it('writes an Israeli mobile number the local way', () => {
    expect(formatPhone('+972523401187')).toBe('052-340-1187');
  });

  it('keeps any other number as it is', () => {
    expect(formatPhone('+14155550123')).toBe('+14155550123');
  });
});

describe('telHref', () => {
  it('links an international number as it is', () => {
    expect(telHref('+972523401187')).toBe('tel:+972523401187');
    expect(telHref('+14155550123')).toBe('tel:+14155550123');
  });

  it.each(['', '0523401187', '+972 52 340 1187', '+0123456', '+123456', '+1234567890123456'])(
    'has no link for %j',
    (phone) => {
      expect(telHref(phone)).toBeNull();
    },
  );
});
