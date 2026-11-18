import { describe, expect, it } from 'vitest';
import { ownActiveSos, ownClosedSos, upsertSos } from '.';
import { makeSos, OWN_PARTICIPANT_ID } from '../fixtures';

const other = {
  participantId: '00000000-0000-4000-8000-0000000000ff',
  searcherId: '00000000-0000-4000-8000-0000000000fe',
  callsign: 9,
  name: 'אלון',
};

describe('upsertSos', () => {
  it('adds a new SOS and keeps the newest first', () => {
    const old = makeSos({ id: '00000000-0000-4000-8000-000000000001', activatedAt: '2026-10-03T10:00:00.000Z' });
    const fresh = makeSos({ id: '00000000-0000-4000-8000-000000000002' });
    expect(upsertSos([old], fresh).map((s) => s.id)).toEqual([fresh.id, old.id]);
  });

  it('replaces an SOS it already has', () => {
    const active = makeSos();
    const closed = makeSos({ status: 'closed', closedAt: '2026-10-03T17:10:00.000Z' });
    const list = upsertSos([active], closed);
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe('closed');
  });
});

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
