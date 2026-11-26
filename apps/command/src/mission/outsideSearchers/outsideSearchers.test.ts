import type { Participant, TimelineEvent } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { outsideSearchers } from '.';
import { participants, polygonA } from '../fixtures';

const found = participants[0];
if (!found) throw new Error('fixture');
const dana: Participant = found;
const subject = { kind: 'participant', id: dana.id, label: 'דנה כהן', callsign: 4 } as const;
let n = 0;
const base = () => ({
  id: `00000000-0000-4000-8000-00000000f${String(++n).padStart(3, '0')}`,
  missionId: '00000000-0000-4000-8000-000000000001',
  occurredAt: `2026-10-03T13:${String(10 + n).padStart(2, '0')}:00.000Z`,
  actor: { kind: 'system' } as const,
  subject,
});
const details = { polygonId: polygonA.id, polygonName: polygonA.name };
const left = (meters = 80): TimelineEvent => ({
  ...base(),
  type: 'searcher.left_polygon',
  details: { ...details, meters },
});
const returned = (): TimelineEvent => ({ ...base(), type: 'searcher.returned_to_polygon', details });
const searching = (change: Partial<Participant> = {}): Participant => ({ ...dana, ...change });

describe('outsideSearchers', () => {
  it('lists a searcher whose last presence event is leaving, with where, how far and since when', () => {
    const exit = left(80);
    expect(outsideSearchers([exit], [searching()])).toEqual([
      {
        participantId: dana.id,
        callsign: 4,
        name: 'דנה כהן',
        polygonName: polygonA.name,
        meters: 80,
        since: exit.occurredAt,
      },
    ]);
  });

  it('lists nothing once the searcher has returned, and again after a second exit', () => {
    expect(outsideSearchers([left(), returned()], [searching()])).toEqual([]);
    expect(outsideSearchers([left(), returned(), left(30)], [searching()])).toHaveLength(1);
  });

  it('lists nothing for a searcher no longer Searching in that polygon', () => {
    expect(outsideSearchers([left()], [searching({ taskStatus: 'paused' })])).toEqual([]);
    expect(outsideSearchers([left()], [searching({ polygonId: null, status: 'available', taskStatus: null })])).toEqual(
      [],
    );
    expect(outsideSearchers([left()], [searching({ polygonId: '00000000-0000-4000-8000-0000000000b2' })])).toEqual([]);
    expect(outsideSearchers([left()], [searching({ status: 'ended' })])).toEqual([]);
  });

  it('lists the earliest exit first', () => {
    const other: Participant = { ...dana, id: '00000000-0000-4000-8000-00000000000b', callsign: 11 };
    const first = left();
    const second: TimelineEvent = { ...left(), subject: { ...subject, id: other.id, callsign: 11 } };
    const list = outsideSearchers([first, second], [other, searching()]);
    expect(list.map((s) => s.callsign)).toEqual([4, 11]);
  });
});
