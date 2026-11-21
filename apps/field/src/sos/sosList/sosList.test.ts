import { describe, expect, it } from 'vitest';
import { endedSentence, ownActiveSos, ownClosedSos, sosLocationOf } from '.';
import { makeSos, OWN_PARTICIPANT_ID } from '../fixtures';

const other = {
  participantId: '00000000-0000-4000-8000-0000000000ff',
  searcherId: '00000000-0000-4000-8000-0000000000fe',
  callsign: 9,
  name: 'אלון',
};

describe('own SOS', () => {
  it('finds the active SOS of this participant and ignores one sent to them', () => {
    const mine = makeSos();
    const theirs = makeSos({ id: '00000000-0000-4000-8000-000000000009', sender: other });
    expect(ownActiveSos([theirs, mine], OWN_PARTICIPANT_ID)).toBe(mine);
    expect(ownActiveSos([theirs], OWN_PARTICIPANT_ID)).toBeNull();
    expect(ownActiveSos([mine], undefined)).toBeNull();
  });

  it('finds the newest closed SOS only when the newest own SOS is closed', () => {
    const closed = makeSos({
      status: 'closed',
      closedAt: '2026-10-03T17:10:00.000Z',
      closedBy: { role: 'commander', name: 'רן' },
    });
    expect(ownClosedSos([closed], OWN_PARTICIPANT_ID)).toBe(closed);
    expect(ownClosedSos([makeSos(), closed], OWN_PARTICIPANT_ID)).toBeNull();
  });
});

describe('endedSentence', () => {
  it('says who closed the SOS', () => {
    const base = { status: 'closed' as const, closedAt: '2026-10-03T17:10:00.000Z' };
    expect(endedSentence(makeSos({ ...base, closedBy: { role: 'commander', name: 'רן' } }))).toContain('על ידי המנהל');
    expect(endedSentence(makeSos({ ...base, closedBy: { role: 'searcher', name: 'דנה' } }))).toContain('על ידך');
    expect(endedSentence(makeSos())).toBeNull();
    expect(endedSentence(null)).toBeNull();
  });
});

describe('sosLocationOf', () => {
  it('turns a fix into the SOS location, and nothing into null', () => {
    expect(sosLocationOf({ position: [35.1, 31.7], accuracy: 4, at: 0 })).toEqual({
      position: { type: 'Point', coordinates: [35.1, 31.7] },
      recordedAt: '1970-01-01T00:00:00.000Z',
      accuracy: 4,
    });
    expect(sosLocationOf(null)).toBeNull();
  });
});
