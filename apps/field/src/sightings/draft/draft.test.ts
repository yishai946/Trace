import { describe, expect, it } from 'vitest';
import { clockOf, observedAtOf, parseClock, toSighting, type SightingDraft } from '.';

const now = new Date(2026, 9, 3, 17, 0, 30, 500);
const id = '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0d';
const draft: SightingDraft = {
  source: 'witness',
  position: [35.0139, 31.7412],
  clock: '16:58',
  description: '  אדם עם כובע אפור  ',
};

describe('clockOf', () => {
  it('writes hours and minutes with two digits', () => {
    expect(clockOf(new Date(2026, 9, 3, 7, 5))).toBe('07:05');
  });
});

describe('parseClock', () => {
  it.each([
    ['16:58', { hours: 16, minutes: 58 }],
    ['7:05', { hours: 7, minutes: 5 }],
    [' 09:00 ', { hours: 9, minutes: 0 }],
  ])('accepts %j', (text, expected) => {
    expect(parseClock(text)).toEqual(expected);
  });

  it.each(['24:00', '12:60', '1658', '', 'ab'])('refuses %j', (text) => {
    expect(parseClock(text)).toBeNull();
  });
});

describe('observedAtOf', () => {
  it('puts a time before now on today', () => {
    expect(observedAtOf('16:58', now)).toEqual(new Date(2026, 9, 3, 16, 58));
  });

  it('puts a time later than now on the day before', () => {
    expect(observedAtOf('23:50', now)).toEqual(new Date(2026, 9, 2, 23, 50));
  });

  it('keeps the current minute on today', () => {
    expect(observedAtOf('17:00', now)).toEqual(new Date(2026, 9, 3, 17, 0));
  });

  it('is null for a time that cannot be read', () => {
    expect(observedAtOf('25:00', now)).toBeNull();
  });
});

describe('toSighting', () => {
  it('builds the body with the id, a trimmed description and the local time as an instant', () => {
    expect(toSighting(draft, { now, id })).toEqual({
      sighting: {
        id,
        position: { type: 'Point', coordinates: [35.0139, 31.7412] },
        observedAt: new Date(2026, 9, 3, 16, 58).toISOString(),
        source: 'witness',
        description: 'אדם עם כובע אפור',
      },
    });
  });

  it('turns a blank description into null', () => {
    const result = toSighting({ ...draft, description: '   ' }, { now, id });
    expect('sighting' in result && result.sighting.description).toBeNull();
  });

  it('reports a missing position', () => {
    expect(toSighting({ ...draft, position: null }, { now, id })).toEqual({
      errors: { position: 'בחר את מקום התצפית במפה, או המתן למיקום שלך.' },
    });
  });

  it('reports every error together', () => {
    expect(toSighting({ ...draft, position: null, clock: '25:00' }, { now, id })).toEqual({
      errors: { position: 'בחר את מקום התצפית במפה, או המתן למיקום שלך.', clock: 'הזן שעה כמו 16:58.' },
    });
  });
});
