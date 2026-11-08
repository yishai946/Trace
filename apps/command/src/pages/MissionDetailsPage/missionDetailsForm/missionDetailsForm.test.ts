import type { Mission } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../../../api';
import { mission as savedMission } from '../../../mission/fixtures';
import {
  DETAILS_MESSAGES,
  fromMission,
  isChanged,
  saveErrorMessage,
  toUpdateBody,
  validate,
  type MissionDetailsForm,
} from '.';

// Built from local parts, so the tests hold in any time zone.
const disappearedAt = new Date(2026, 9, 3, 11, 20).toISOString();
const mission: Mission = {
  ...savedMission,
  missingPerson: {
    ...savedMission.missingPerson,
    disappearedAt,
    description: 'מעיל חום',
    additionalInfo: 'דמנציה קלה',
  },
};

const form = (changes: Partial<MissionDetailsForm> = {}): MissionDetailsForm => ({
  ...fromMission(mission),
  ...changes,
});

describe('fromMission', () => {
  it('fills the form with the mission as saved; missing values are empty', () => {
    expect(fromMission(savedMission)).toEqual({
      name: 'מסע 0412',
      personName: 'נועם אברהם',
      age: '74',
      disappearedAt: '',
      description: '',
      additionalInfo: '',
    });
    expect(fromMission(mission).disappearedAt).toBe('2026-10-03T11:20');
  });
});

describe('validate', () => {
  it('flags a blank mission name', () => {
    expect(validate(form({ name: '   ' }))).toEqual({ name: DETAILS_MESSAGES.name });
    expect(validate(form())).toEqual({});
  });

  it('flags an age that is not a whole number from 0 to 130', () => {
    for (const age of ['131', '-1', '1.5', 'שבעים'])
      expect(validate(form({ age }))).toEqual({ age: DETAILS_MESSAGES.age });
    for (const age of ['', '0', '130']) expect(validate(form({ age }))).toEqual({});
  });
});

describe('toUpdateBody', () => {
  it('trims text, turns blanks into null and converts the age and the time', () => {
    expect(
      toUpdateBody({
        name: ' מסע 0412 ',
        personName: '  ',
        age: ' 75 ',
        disappearedAt: '2026-10-03T11:20',
        description: ' מעיל חום ',
        additionalInfo: '',
      }),
    ).toEqual({
      name: 'מסע 0412',
      missingPerson: {
        name: null,
        age: 75,
        disappearedAt: new Date('2026-10-03T11:20').toISOString(),
        description: 'מעיל חום',
        additionalInfo: null,
      },
    });
    expect(toUpdateBody(form({ age: '' })).missingPerson.age).toBeNull();
  });
});

describe('isChanged', () => {
  it('ignores surrounding spaces and sees any other change', () => {
    expect(isChanged(fromMission(mission), mission)).toBe(false);
    expect(isChanged(form({ name: ' מסע 0412 ', description: ' מעיל חום ' }), mission)).toBe(false);
    const changes: Partial<MissionDetailsForm>[] = [
      { name: 'מסע 0413' },
      { personName: 'נועם' },
      { age: '75' },
      { disappearedAt: '2026-10-03T11:21' },
      { description: 'מעיל' },
      { additionalInfo: '' },
    ];
    for (const change of changes) expect(isChanged(form(change), mission)).toBe(true);
  });
});

describe('saveErrorMessage', () => {
  it('explains each kind of failure in Hebrew', () => {
    const message = (code: ApiRequestError['code']) => saveErrorMessage(new ApiRequestError(500, code, 'x'));
    expect(message('NETWORK_ERROR')).toBe('אין חיבור לשרת. השינויים לא נשמרו.');
    expect(message('MISSION_ENDED')).toBe('המסע הסתיים. אי אפשר לשמור שינויים.');
    expect(message('VALIDATION_ERROR')).toBe('הפרטים אינם תקינים. בדקו את השדות ונסו שוב.');
    expect(message('FORBIDDEN')).toBe('המסע לא זמין לשינוי. רעננו את המסך.');
    expect(message('NOT_FOUND')).toBe('המסע לא זמין לשינוי. רעננו את המסך.');
    expect(saveErrorMessage(new Error('boom'))).toBe('השינויים לא נשמרו. נסו שוב.');
  });
});
