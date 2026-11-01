import { describe, expect, it } from 'vitest';
import { toMapData } from '.';
import { mission, participants, polygonA, polygonB } from '../fixtures';

describe('toMapData', () => {
  const base = {
    mission,
    polygons: [polygonA, polygonB],
    participants,
    selectedPolygonId: null,
    editingPolygonId: null,
  };

  it('shows the rally point and the current LKP in Israel time', () => {
    const data = toMapData(base);
    expect(data.rally).toEqual([35.1335, 31.7835]);
    expect(data.lkp).toMatchObject({ position: [35.137, 31.769], time: '13:05' });
  });

  it('shows only searchers with a known position', () => {
    expect(toMapData(base).units).toEqual([
      { id: participants[0]?.id, callsign: 4, state: 'normal', position: [35.128, 31.775] },
    ]);
  });

  it('marks the selected polygon and hides the one being reshaped', () => {
    const data = toMapData({ ...base, selectedPolygonId: polygonA.id, editingPolygonId: polygonB.id });
    expect(data.polygons.map((p) => [p.letter, p.selected])).toEqual([['A', true]]);
  });
});
