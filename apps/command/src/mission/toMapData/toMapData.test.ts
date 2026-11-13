import { describe, expect, it } from 'vitest';
import { toMapData } from '.';
import {
  lkps,
  mission,
  participants,
  polygonA,
  polygonB,
  reportFinding,
  reportHazard,
  reportLocated,
  sightingA,
  sightingB,
  sightingC,
} from '../fixtures';

describe('toMapData', () => {
  const base = {
    mission,
    polygons: [polygonA, polygonB],
    participants,
    selectedPolygonId: null,
    editingPolygonId: null,
    sightings: [],
    lkps: [],
    reports: [],
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
    expect(data.polygons.map((p) => [p.name, p.selected])).toEqual([['ואדי צפוני', true]]);
  });

  it('shows past LKPs with their time, and the current one apart', () => {
    const data = toMapData({ ...base, lkps });
    expect(data.lkp).toMatchObject({ time: '13:05' });
    expect(data.lkpHistory).toEqual([{ id: lkps[1]?.id, position: [35.1398, 31.7398], time: '12:10' }]);
  });

  it('shows sightings with their number and Israel time, marking the suggested ones', () => {
    const data = toMapData({ ...base, sightings: [sightingA, sightingB] });
    expect(data.sightings).toEqual([
      { id: sightingA.id, position: [35.1412, 31.7745], time: '14:22', label: '1 14:22', suggested: true },
      { id: sightingB.id, position: [35.1441, 31.7712], time: '16:02', label: '2 16:02', suggested: false },
    ]);
  });

  it('shows a searcher’s sighting like the commander’s, suggested while it is later than the LKP', () => {
    const data = toMapData({ ...base, sightings: [sightingC] });
    expect(data.sightings).toEqual([
      { id: sightingC.id, position: [35.1412, 31.7745], time: '16:58', label: '3 16:58', suggested: true },
    ]);
  });

  it('does not draw an accepted sighting twice, since it is the LKP or a past LKP', () => {
    const accepted = { ...sightingA, lkpDecision: 'accepted' as const, lkpCandidate: false };
    expect(toMapData({ ...base, sightings: [accepted, sightingB] }).sightings.map((s) => s.id)).toEqual([sightingB.id]);
  });

  it('draws every report, New and Handled, marking hazards and located ones', () => {
    const data = toMapData({ ...base, reports: [reportLocated, reportFinding, reportHazard] });
    expect(data.reports).toEqual([
      { id: reportLocated.id, position: [35.1318, 31.7752], time: '16:51', hazard: false, located: true },
      { id: reportFinding.id, position: [35.1301, 31.7742], time: '16:44', hazard: false, located: false },
      { id: reportHazard.id, position: [35.1252, 31.7721], time: '16:31', hazard: true, located: false },
    ]);
  });
});
