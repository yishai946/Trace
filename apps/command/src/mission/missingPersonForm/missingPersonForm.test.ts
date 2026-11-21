import { describe, expect, it } from 'vitest';
import { AGE_MESSAGE, MAX_AGE, ageError, toMissingPerson } from './index';

describe('ageError', () => {
  it('accepts an empty age and whole numbers up to the maximum', () => {
    expect(ageError('')).toBeUndefined();
    expect(ageError('  ')).toBeUndefined();
    expect(ageError('0')).toBeUndefined();
    expect(ageError(` ${MAX_AGE} `)).toBeUndefined();
  });

  it('refuses anything else', () => {
    for (const age of ['131', '-1', '4.5', 'abc', '1e2']) expect(ageError(age)).toBe(AGE_MESSAGE);
  });
});

describe('toMissingPerson', () => {
  it('trims text, turns blanks into null and parses the age and the time', () => {
    const disappearedAt = '2026-03-04T05:06';
    expect(
      toMissingPerson({
        personName: ' Dana ',
        age: ' 12 ',
        disappearedAt,
        description: ' ',
        additionalInfo: 'x ',
      }),
    ).toEqual({
      name: 'Dana',
      age: 12,
      disappearedAt: new Date(disappearedAt).toISOString(),
      description: null,
      additionalInfo: 'x',
    });
  });

  it('gives null for an empty age and an empty time', () => {
    const body = toMissingPerson({ personName: '', age: '', disappearedAt: '', description: '', additionalInfo: '' });
    expect(body).toEqual({ name: null, age: null, disappearedAt: null, description: null, additionalInfo: null });
  });
});
