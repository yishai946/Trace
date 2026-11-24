import { describe, expect, it } from 'vitest';
import { formatPhone, parsePhone, telHref } from '.';

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

describe('parsePhone', () => {
  it.each([
    ['052-340-1187', '+972523401187'],
    ['0523401187', '+972523401187'],
    ['  052 340 1187 ', '+972523401187'],
    ['+972-52-340-1187', '+972523401187'],
    ['+972523401187', '+972523401187'],
    ['02-5551234', '+97225551234'],
    ['+1 (415) 555-0123', '+14155550123'],
  ])('reads %s as %s', (input, e164) => {
    expect(parsePhone(input)).toBe(e164);
  });

  it.each(['', '   ', 'abc', '052', '05234011871234', '+0123456789', '+12', '052-340-118a', '00972523401187'])(
    'rejects %j',
    (input) => {
      expect(parsePhone(input)).toBeNull();
    },
  );
});
