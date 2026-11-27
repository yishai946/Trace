import { describe, expect, it } from 'vitest';
import { alertFromEvent } from '.';
import { makeSos, OWN_PARTICIPANT_ID } from '../../sos/fixtures';

const missionId = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000009';
const fromOther = makeSos({ sender: { ...makeSos().sender, participantId: OTHER, callsign: 12, name: 'יוסי לוי' } });

describe('alertFromEvent', () => {
  it('raises an alert for an active SOS sent by another searcher', () => {
    const result = alertFromEvent({ type: 'sos.saved', missionId, sos: fromOther }, OWN_PARTICIPANT_ID);
    expect(result).toEqual({
      raise: expect.objectContaining({ id: `sos-${fromOther.id}`, kind: 'sos', href: null }),
    });
    expect(result && 'raise' in result && result.raise.text).toContain('יוסי לוי');
  });

  it('puts the SOS message in the alert text', () => {
    const sos = { ...fromOther, message: 'נפלתי' };
    const result = alertFromEvent({ type: 'sos.saved', missionId, sos }, OWN_PARTICIPANT_ID);
    expect(result && 'raise' in result && result.raise.text).toContain('נפלתי');
  });

  it("ignores the searcher's own SOS", () => {
    expect(alertFromEvent({ type: 'sos.saved', missionId, sos: makeSos() }, OWN_PARTICIPANT_ID)).toBeNull();
  });

  it('withdraws the alert when that SOS is closed', () => {
    const closed = { ...fromOther, status: 'closed' as const };
    expect(alertFromEvent({ type: 'sos.saved', missionId, sos: closed }, OWN_PARTICIPANT_ID)).toEqual({
      dismiss: `sos-${fromOther.id}`,
    });
  });

  it('raises an alert naming the changed details when the commander notified the searchers', () => {
    const mission = { updatedAt: '2026-10-03T10:00:00.000Z' } as never;
    const result = alertFromEvent(
      { type: 'mission.updated', missionId, mission, changedFields: ['description', 'missingPersonAge'] },
      OWN_PARTICIPANT_ID,
    );
    expect(result).toEqual({
      raise: {
        id: 'details-2026-10-03T10:00:00.000Z',
        kind: 'details',
        title: 'פרטי הנעדר עודכנו',
        text: 'עודכנו: תיאור / לבוש, גיל',
        href: '/missing-person',
      },
    });
  });

  it('has no screen to open for a change of the mission name alone', () => {
    const mission = { updatedAt: '2026-10-03T10:00:00.000Z' } as never;
    const result = alertFromEvent({ type: 'mission.updated', missionId, mission, changedFields: ['name'] }, undefined);
    expect(result && 'raise' in result && result.raise.href).toBeNull();
  });

  it('ignores a quiet mission update', () => {
    const mission = { updatedAt: '2026-10-03T10:00:00.000Z' } as never;
    expect(alertFromEvent({ type: 'mission.updated', missionId, mission }, OWN_PARTICIPANT_ID)).toBeNull();
  });

  it('ignores other events', () => {
    const event = { type: 'polygon.deleted', missionId, polygonId: OTHER } as const;
    expect(alertFromEvent(event, OWN_PARTICIPANT_ID)).toBeNull();
  });
});
