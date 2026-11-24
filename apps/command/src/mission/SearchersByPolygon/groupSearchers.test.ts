import type { Participant } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { groupSearchers } from './groupSearchers';
import { participants, polygonA, polygonB } from '../fixtures';

const base = participants[0] as Participant;
const searcher = (callsign: number, extra: Partial<Participant>): Participant => ({
  ...base,
  id: `00000000-0000-4000-8000-0000000002${callsign}`,
  callsign,
  ...extra,
});

describe('groupSearchers', () => {
  it('groups assigned searchers by polygon in the polygons order, then those waiting for an assignment', () => {
    const list = [
      searcher(12, { polygonId: polygonB.id }),
      searcher(3, { status: 'available', polygonId: null, taskStatus: null }),
      searcher(11, { polygonId: polygonA.id }),
      searcher(2, { polygonId: polygonA.id }),
    ];
    const groups = groupSearchers(list, [polygonA, polygonB]);
    expect(groups.map((g) => [g.polygon?.name ?? null, g.searchers.map((p) => p.callsign)])).toEqual([
      [polygonA.name, [2, 11]],
      [polygonB.name, [12]],
      [null, [3]],
    ]);
  });

  it('leaves out polygons nobody is assigned to and searchers who ended', () => {
    const list = [searcher(5, { status: 'ended', polygonId: polygonA.id }), searcher(6, { polygonId: polygonA.id })];
    const groups = groupSearchers(list, [polygonA, polygonB]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.searchers.map((p) => p.callsign)).toEqual([6]);
  });

  it('puts an assigned searcher whose polygon is unknown with those waiting', () => {
    const groups = groupSearchers([searcher(7, { polygonId: polygonB.id })], [polygonA]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.polygon).toBeNull();
  });

  it('returns nothing for no searchers', () => {
    expect(groupSearchers([], [polygonA])).toEqual([]);
  });
});
