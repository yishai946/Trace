import { describe, expect, it } from 'vitest';
import { CreateMissionBody } from '.';

const rallyPoint = { type: 'Point', coordinates: [35.13, 31.78] } as const;
const lkp = { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' };

describe('CreateMissionBody', () => {
  it('requires a name, a rally point and an LKP', () => {
    expect(CreateMissionBody.safeParse({ name: 'מסע 0412', rallyPoint, lkp }).success).toBe(true);
    expect(CreateMissionBody.safeParse({ name: '  ', rallyPoint, lkp }).success).toBe(false);
    expect(CreateMissionBody.safeParse({ name: 'מסע 0412', lkp }).success).toBe(false);
    expect(CreateMissionBody.safeParse({ name: 'מסע 0412', rallyPoint }).success).toBe(false);
  });

  it('fills missing-person fields with null and turns blank text into null', () => {
    const body = CreateMissionBody.parse({
      name: 'מסע',
      rallyPoint,
      lkp,
      missingPerson: { name: ' נועם ', description: ' ' },
    });
    expect(body.missingPerson).toEqual({
      name: 'נועם',
      age: null,
      disappearedAt: null,
      description: null,
      additionalInfo: null,
    });
  });

  it('accepts an LKP with its observation time', () => {
    expect(CreateMissionBody.parse({ name: 'מסע', rallyPoint, lkp }).lkp).toEqual(lkp);
  });

  it('rejects an impossible age', () => {
    expect(CreateMissionBody.safeParse({ name: 'מסע', rallyPoint, lkp, missingPerson: { age: -3 } }).success).toBe(
      false,
    );
  });
});
