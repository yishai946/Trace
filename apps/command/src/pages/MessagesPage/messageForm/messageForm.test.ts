import { describe, expect, it } from 'vitest';
import { participants, polygonA, polygonB } from '../../../mission/fixtures';
import { activeParticipants, countInPolygon, emptyForm, recipientsOf, targetRule, toSendBody, validate } from '.';

const [dana, michal] = participants;
if (!dana || !michal) throw new Error('fixtures');
const ended = { ...michal, id: 'ended', callsign: 1, status: 'ended' as const, polygonId: polygonA.id };
const all = [michal, dana, ended];

describe('recipientsOf', () => {
  it('sends to the whole mission except those whose activity ended', () => {
    expect(recipientsOf(emptyForm, all).map((p) => p.callsign)).toEqual([9, 4]);
  });

  it('sends to those assigned to the chosen polygons, not to available searchers', () => {
    const form = { ...emptyForm, kind: 'polygons' as const, polygonIds: [polygonA.id, polygonB.id] };
    expect(recipientsOf(form, all).map((p) => p.callsign)).toEqual([4]);
  });

  it('sends to exactly one searcher', () => {
    const form = { ...emptyForm, kind: 'searcher' as const, participantId: michal.id };
    expect(recipientsOf(form, all)).toEqual([michal]);
  });

  it('has no recipients while the target is incomplete', () => {
    expect(recipientsOf({ ...emptyForm, kind: 'polygons' }, all)).toEqual([]);
    expect(targetRule({ ...emptyForm, kind: 'searcher' })).toBeNull();
  });
});

describe('activeParticipants and countInPolygon', () => {
  it('lists active searchers by callsign', () => {
    expect(activeParticipants(all).map((p) => p.callsign)).toEqual([4, 9]);
  });

  it('counts the searchers assigned to a polygon', () => {
    expect(countInPolygon(polygonA.id, all)).toBe(1);
    expect(countInPolygon(polygonB.id, all)).toBe(0);
  });
});

describe('validate', () => {
  it('asks for the text', () => {
    expect(validate({ ...emptyForm, body: '   ' })).toEqual({ body: 'כתבו את ההודעה.' });
  });

  it('asks for a polygon or a searcher', () => {
    expect(validate({ ...emptyForm, kind: 'polygons', body: 'א' })).toEqual({ target: 'בחרו לפחות פוליגון אחד.' });
    expect(validate({ ...emptyForm, kind: 'searcher', body: 'א' })).toEqual({ target: 'בחרו מחפש.' });
  });

  it('has no errors when the form is complete', () => {
    expect(validate({ ...emptyForm, body: 'א' })).toEqual({});
  });
});

describe('toSendBody', () => {
  it('builds each kind of target with the body trimmed', () => {
    const body = '  חזרו  ';
    expect(toSendBody({ ...emptyForm, body })).toEqual({
      target: { kind: 'mission' },
      urgency: 'normal',
      body: 'חזרו',
    });
    expect(
      toSendBody({ ...emptyForm, kind: 'polygons', polygonIds: [polygonA.id], urgency: 'critical', body }),
    ).toEqual({
      target: { kind: 'polygons', polygonIds: [polygonA.id] },
      urgency: 'critical',
      body: 'חזרו',
    });
    expect(toSendBody({ ...emptyForm, kind: 'searcher', participantId: dana.id, urgency: 'important', body })).toEqual({
      target: { kind: 'searcher', participantId: dana.id },
      urgency: 'important',
      body: 'חזרו',
    });
  });
});
