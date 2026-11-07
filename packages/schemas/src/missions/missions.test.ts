import { describe, expect, it } from 'vitest';
import { CreateMissionBody, UpdateRallyPointBody } from '.';

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

describe('UpdateRallyPointBody', () => {
  it('accepts a point', () => {
    expect(UpdateRallyPointBody.parse({ rallyPoint })).toEqual({ rallyPoint });
  });

  it.each([
    ['a missing point', {}],
    ['a latitude above 90', { rallyPoint: { type: 'Point', coordinates: [35, 91] } }],
    ['a latitude below -90', { rallyPoint: { type: 'Point', coordinates: [35, -91] } }],
    ['a longitude above 180', { rallyPoint: { type: 'Point', coordinates: [181, 31] } }],
    ['a longitude below -180', { rallyPoint: { type: 'Point', coordinates: [-181, 31] } }],
    ['a polygon', { rallyPoint: { type: 'Polygon', coordinates: [[[0, 0]]] } }],
    ['one coordinate', { rallyPoint: { type: 'Point', coordinates: [35] } }],
    ['three coordinates', { rallyPoint: { type: 'Point', coordinates: [35, 31, 5] } }],
    ['text coordinates', { rallyPoint: { type: 'Point', coordinates: ['35', '31'] } }],
  ])('rejects %s', (_name, body) => {
    expect(UpdateRallyPointBody.safeParse(body).success).toBe(false);
  });
});
