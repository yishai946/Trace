import { describe, expect, it } from 'vitest';
import { initialForm, MESSAGES, toBody, validate, type EndLocatedForm } from '.';

const complete: EndLocatedForm = { position: [35.14, 31.77], locatedAt: '2026-10-03T16:40', note: ' נמצא בהכרה ' };

describe('validate', () => {
  it('accepts a place and a time, with or without a note', () => {
    expect(validate(complete)).toEqual({});
    expect(validate({ ...complete, note: '' })).toEqual({});
  });

  it('reports a missing place and a missing time, each with its own message', () => {
    expect(validate({ ...complete, position: null })).toEqual({ position: MESSAGES.position });
    expect(validate({ ...complete, locatedAt: '' })).toEqual({ locatedAt: MESSAGES.locatedAt });
    expect(Object.keys(validate({ position: null, locatedAt: '', note: '' }))).toEqual(['position', 'locatedAt']);
  });
});

describe('toBody', () => {
  it('sends the place as a point, the time as an instant and the trimmed note', () => {
    expect(toBody(complete)).toEqual({
      position: { type: 'Point', coordinates: [35.14, 31.77] },
      locatedAt: new Date('2026-10-03T16:40').toISOString(),
      note: 'נמצא בהכרה',
    });
  });

  it('refuses an incomplete form', () => {
    expect(() => toBody({ ...complete, position: null })).toThrow();
  });
});

describe('initialForm', () => {
  it('starts at the given time, with no place and no note', () => {
    expect(initialForm(new Date(2026, 9, 3, 16, 40))).toEqual({
      position: null,
      locatedAt: '2026-10-03T16:40',
      note: '',
    });
  });
});
