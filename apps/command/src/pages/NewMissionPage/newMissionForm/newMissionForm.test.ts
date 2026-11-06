import { CreateMissionBody } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { emptyForm, formatCoordinate, MESSAGES, missionName, parseLatLng, toCreateBody, validate } from '.';

const rally: [number, number] = [35.1335, 31.7835];
const lkp: [number, number] = [35.137, 31.769];
const placed = { lkp, lkpObservedAt: '2026-10-02T13:05', rally };

describe('validate', () => {
  it('requires a name, an LKP and a rally point', () => {
    expect(validate({ ...emptyForm, personName: 'נועם', ...placed })).toEqual({});
    expect(validate(emptyForm)).toEqual({ personName: MESSAGES.personName, lkp: MESSAGES.lkp, rally: MESSAGES.rally });
    expect(validate({ ...emptyForm, name: '0412', ...placed })).toEqual({});
  });

  it('checks the age and asks when the person was at the LKP once an LKP is placed', () => {
    const form = { ...emptyForm, name: '0412', rally, age: '7a', lkp };
    expect(validate(form)).toEqual({ age: MESSAGES.age, lkpObservedAt: MESSAGES.lkpObservedAt });
    expect(validate({ ...form, age: '131' }).age).toBe(MESSAGES.age);
    expect(validate({ ...form, age: '74', lkpObservedAt: '2026-10-03T13:05' })).toEqual({});
  });
});

describe('missionName', () => {
  it("follows the missing person's name until a name is typed", () => {
    expect(missionName({ name: '', personName: ' נועם אברהם ' })).toBe('נועם אברהם');
    expect(missionName({ name: ' מסע 0412 ', personName: 'נועם אברהם' })).toBe('מסע 0412');
    expect(missionName({ name: '', personName: '' })).toBe('');
  });
});

describe('toCreateBody', () => {
  it('builds a request the API accepts, leaving empty fields out', () => {
    const body = toCreateBody({ ...emptyForm, name: ' 0412 ', personName: 'נועם', age: '74', ...placed });
    expect(CreateMissionBody.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      name: '0412',
      missingPerson: { name: 'נועם', age: 74, description: null, disappearedAt: null },
      rallyPoint: { type: 'Point', coordinates: rally },
    });
  });

  it('adds the LKP with its time', () => {
    const body = toCreateBody({
      ...emptyForm,
      name: '0412',
      rally,
      lkp: [35.137, 31.769],
      lkpObservedAt: '2026-10-02T13:05',
      disappearedAt: '2026-10-03T11:20',
    });
    expect(CreateMissionBody.safeParse(body).success).toBe(true);
    expect(body.lkp?.observedAt).toBe(new Date('2026-10-02T13:05').toISOString());
    expect(body.missingPerson?.disappearedAt).toBe(new Date('2026-10-03T11:20').toISOString());
  });
});

describe('parseLatLng', () => {
  it('reads latitude and longitude into a map point', () => {
    expect(parseLatLng(' 31.7431', '35.0127 ')).toEqual([35.0127, 31.7431]);
  });

  it('rejects partial, non-numeric and off-globe values', () => {
    expect(parseLatLng('31.7', '')).toBeNull();
    expect(parseLatLng('abc', '35')).toBeNull();
    expect(parseLatLng('91', '35')).toBeNull();
  });
});

describe('formatCoordinate', () => {
  it('keeps five decimals at most', () => {
    expect(formatCoordinate(35.0127123)).toBe('35.01271');
    expect(formatCoordinate(31.5)).toBe('31.5');
  });
});
