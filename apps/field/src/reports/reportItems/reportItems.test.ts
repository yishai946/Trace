import type { CreateReportBody, MissionPolygon } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { filterItems, formatDistance, toMapReports, toReportItems } from '.';
import { assigned, makeReport, POLYGON_A, POLYGON_B } from '../fixtures';

const polygon = (id: string, name: string): MissionPolygon =>
  ({ id, name, geometry: { type: 'Polygon', coordinates: [] } }) as unknown as MissionPolygon;
const polygons = [polygon(POLYGON_A, 'A'), polygon(POLYGON_B, 'B')];

const mineBy = (overrides = {}) =>
  makeReport({ reportedBy: { role: 'searcher', name: 'דנה', callsign: assigned.callsign }, ...overrides });
const pendingBody = (id: string, reportedAt: string): CreateReportBody => ({
  id,
  type: 'general',
  text: 'ממתין',
  position: { type: 'Point', coordinates: [35.01, 31.74] },
  accuracy: null,
  reportedAt,
});
const base = { pending: [], participation: assigned, polygons, from: null };

describe('toReportItems', () => {
  it('describes a report of someone else, with the author, the polygon name and the distance from me', () => {
    const report = makeReport({ position: { type: 'Point', coordinates: [35.0, 31.001] } });
    const [item] = toReportItems({ ...base, reports: [report], from: [35.0, 31.0] });
    expect(item).toMatchObject({
      id: report.id,
      type: 'hazard',
      typeLabel: 'מפגע',
      text: 'מדרון חלק',
      mine: false,
      callsign: 11,
      name: 'יוסי דהן',
      polygonId: POLYGON_A,
      polygonName: 'A',
      pending: false,
      hazard: true,
      located: false,
      position: [35.0, 31.001],
      photoUrl: null,
    });
    expect(item?.distanceMeters).toBeCloseTo(111, 0);
    expect(item?.time).toMatch(/\d{2}:\d{2}/);
  });

  it('gives no distance for my own report or without a fix', () => {
    const own = mineBy();
    const [withFix] = toReportItems({ ...base, reports: [own], from: [35.0, 31.0] });
    expect(withFix).toMatchObject({ mine: true, distanceMeters: null });
    const [noFix] = toReportItems({ ...base, reports: [makeReport()] });
    expect(noFix?.distanceMeters).toBeNull();
  });

  it('flags a located report and keeps the photo address', () => {
    const report = makeReport({ type: 'located', hasPhoto: true, photoUrl: '/api/x?v=1' });
    expect(toReportItems({ ...base, reports: [report] })[0]).toMatchObject({
      located: true,
      hazard: false,
      photoUrl: '/api/x?v=1',
    });
  });

  it('adds the reports that wait on the phone as my own, and the server’s copy wins', () => {
    const onServer = mineBy({ reportedAt: '2026-10-03T10:00:00.000Z' });
    const waiting = pendingBody('0190a3b2-7c4e-7a10-8a5e-0000000000aa', '2026-10-03T11:00:00.000Z');
    const duplicate = pendingBody(onServer.id, onServer.reportedAt);
    const items = toReportItems({ ...base, reports: [onServer], pending: [duplicate, waiting] });
    expect(items.map((i) => [i.id, i.pending])).toEqual([
      [waiting.id, true],
      [onServer.id, false],
    ]);
    expect(items[0]).toMatchObject({
      mine: true,
      callsign: assigned.callsign,
      polygonId: POLYGON_A,
      polygonName: 'A',
      typeLabel: 'כללי',
      text: 'ממתין',
    });
  });

  it('gives a waiting report no polygon when I am not assigned', () => {
    const available = { ...assigned, status: 'available' as const, polygonId: null };
    const [item] = toReportItems({
      ...base,
      participation: available,
      reports: [],
      pending: [pendingBody('0190a3b2-7c4e-7a10-8a5e-0000000000ab', '2026-10-03T11:00:00.000Z')],
    });
    expect(item).toMatchObject({ pending: true, polygonId: null, polygonName: null });
  });

  it('drops the reports of another polygon and sorts newest first', () => {
    const older = makeReport({ reportedAt: '2026-10-03T10:00:00.000Z' });
    const newer = makeReport({ reportedAt: '2026-10-03T12:00:00.000Z' });
    const elsewhere = makeReport({ polygonId: POLYGON_B });
    expect(toReportItems({ ...base, reports: [older, elsewhere, newer] }).map((i) => i.id)).toEqual([
      newer.id,
      older.id,
    ]);
  });

  it('is empty without reports or a participation', () => {
    expect(toReportItems({ ...base, reports: [] })).toEqual([]);
    expect(toReportItems({ ...base, reports: [makeReport()], participation: null })).toEqual([]);
  });
});

describe('filterItems', () => {
  const own = mineBy({ polygonId: POLYGON_B });
  const items = toReportItems({ ...base, reports: [makeReport(), mineBy(), own] });

  it('"polygon" keeps what was sent from my polygon, mine included', () => {
    expect(filterItems(items, 'polygon', assigned.polygonId).every((i) => i.polygonId === POLYGON_A)).toBe(true);
    expect(filterItems(items, 'polygon', assigned.polygonId)).toHaveLength(2);
  });

  it('"mine" keeps my own reports from any polygon', () => {
    expect(filterItems(items, 'mine', assigned.polygonId).map((i) => i.mine)).toEqual([true, true]);
  });
});

describe('toMapReports', () => {
  it('turns items into map symbols', () => {
    const items = toReportItems({ ...base, reports: [makeReport({ type: 'located' })] });
    expect(toMapReports(items)).toEqual([
      { id: items[0]?.id, position: [35.0152, 31.7421], time: items[0]?.time, hazard: false, located: true },
    ]);
  });
});

describe('formatDistance', () => {
  it('rounds to ten meters under a kilometer', () => {
    expect(formatDistance(0)).toBe('0 מ׳ ממני');
    expect(formatDistance(124)).toBe('120 מ׳ ממני');
  });

  it('uses kilometers with one decimal from 1000 meters, also when rounding reaches it', () => {
    expect(formatDistance(996)).toBe('1.0 ק״מ ממני');
    expect(formatDistance(3240)).toBe('3.2 ק״מ ממני');
  });
});
