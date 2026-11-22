import { describe, expect, it } from 'vitest';
import {
  MISSION_DETAIL_FIELDS,
  MISSION_DETAIL_FIELD_LABELS,
  changedMissionDetails,
  detailChangesText,
  type MissionDetailValues,
} from './index';

const base: MissionDetailValues = {
  name: 'מסע',
  missingPersonName: 'דנה',
  missingPersonAge: 74,
  disappearedAt: '2026-10-03T08:20:00.000Z',
  description: 'מעיל חום',
  additionalInfo: null,
};

/** The unchanged part of the base values, so the test can put the changed ones first. */
function omit(values: MissionDetailValues): Omit<MissionDetailValues, 'name' | 'additionalInfo'> {
  const { missingPersonName, missingPersonAge, disappearedAt, description } = values;
  return { missingPersonName, missingPersonAge, disappearedAt, description };
}

describe('changedMissionDetails', () => {
  it('returns nothing for identical values', () => {
    expect(changedMissionDetails(base, { ...base })).toEqual([]);
  });

  it('returns the changed fields in form order, whatever the property order', () => {
    const after: MissionDetailValues = { additionalInfo: 'חבר בקבוצה', name: 'מסע 0412', ...omit(base) };
    expect(changedMissionDetails(base, after)).toEqual(['name', 'additionalInfo']);
  });

  it('counts a cleared value and a filled one', () => {
    expect(changedMissionDetails(base, { ...base, description: null })).toEqual(['description']);
    expect(changedMissionDetails({ ...base, missingPersonAge: null }, base)).toEqual(['missingPersonAge']);
  });

  it('compares the disappearance time as an instant', () => {
    const before = { ...base, disappearedAt: '2026-10-03T08:20:00.000Z' };
    expect(changedMissionDetails(before, { ...base, disappearedAt: '2026-10-03T11:20:00+03:00' })).toEqual([]);
    expect(changedMissionDetails(before, { ...base, disappearedAt: '2026-10-03T11:20:00+02:00' })).toEqual([
      'disappearedAt',
    ]);
    expect(changedMissionDetails({ ...base, disappearedAt: null }, before)).toEqual(['disappearedAt']);
  });
});

describe('detailChangesText', () => {
  it('reads as a fact for none, one and several fields', () => {
    expect(detailChangesText([])).toBe('פרטי המסע והנעדר עודכנו');
    expect(detailChangesText(['missingPersonAge'])).toBe('עודכן: גיל');
    expect(detailChangesText(['description', 'additionalInfo'])).toBe('עודכנו: תיאור / לבוש, מידע רלוונטי');
  });
});

describe('MISSION_DETAIL_FIELD_LABELS', () => {
  it('labels every field', () => {
    expect(MISSION_DETAIL_FIELDS.every((field) => MISSION_DETAIL_FIELD_LABELS[field].length > 0)).toBe(true);
  });
});
