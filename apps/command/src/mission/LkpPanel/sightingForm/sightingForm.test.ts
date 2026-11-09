import { describe, expect, it } from 'vitest';
import { emptyForm, MESSAGES, nowLocal, toCreateBody, validate, type SightingForm } from '.';

const complete: SightingForm = {
  source: 'witness',
  position: [35.14, 31.77],
  observedAt: '2026-10-03T14:22',
  description: ' מטייל ראה אדם ',
};

describe('validate', () => {
  it('accepts a complete sighting, with or without a description', () => {
    expect(validate(complete)).toEqual({});
    expect(validate({ ...complete, description: '' })).toEqual({});
  });

  it('reports a missing location, time and source, each with its own message', () => {
    expect(validate({ ...emptyForm, observedAt: '' })).toEqual({
      position: MESSAGES.position,
      observedAt: MESSAGES.observedAt,
      source: MESSAGES.source,
    });
  });
});

describe('toCreateBody', () => {
  it('converts the local time to an instant and trims the description', () => {
    expect(toCreateBody(complete)).toEqual({
      position: { type: 'Point', coordinates: [35.14, 31.77] },
      observedAt: new Date('2026-10-03T14:22').toISOString(),
      source: 'witness',
      description: 'מטייל ראה אדם',
    });
  });

  it('sends a blank description as empty, which the server stores as null', () => {
    expect(toCreateBody({ ...complete, description: '   ' }).description).toBe('');
  });

  it('refuses an incomplete form', () => {
    expect(() => toCreateBody(emptyForm)).toThrow();
  });
});

describe('nowLocal', () => {
  it('writes the local date and time to the minute', () => {
    expect(nowLocal(new Date(2026, 9, 3, 7, 5, 30))).toBe('2026-10-03T07:05');
  });
});
