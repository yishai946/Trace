import type { MissionPolygon } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { formatTime, toMissionArea } from '.';

const polygon = (id: string, ring: [number, number][], overrides: Partial<MissionPolygon> = {}): MissionPolygon => ({
  id,
  missionId: '00000000-0000-4000-8000-000000000001',
  name: `פוליגון ${id}`,
  status: 'active',
  coverage: 40,
  activeSearchers: 1,
  geometry: { type: 'Polygon', coordinates: [ring] },
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
  ...overrides,
});

describe('toMissionArea', () => {
  it('shows nothing and has no bounds before the mission has polygons', () => {
    const area = toMissionArea([]);
    expect(area.data.polygons).toEqual([]);
    expect(area.bounds).toBeNull();
  });

  it('draws every polygon of the mission and frames all of them', () => {
    const area = toMissionArea([
      polygon('a', [
        [35, 31.7],
        [35.01, 31.7],
        [35.01, 31.71],
        [35, 31.7],
      ]),
      polygon(
        'b',
        [
          [35.02, 31.69],
          [35.03, 31.69],
          [35.03, 31.72],
          [35.02, 31.69],
        ],
        { status: 'completed', coverage: 100 },
      ),
    ]);

    expect(area.data.polygons.map((p) => [p.id, p.name, p.status])).toEqual([
      ['a', 'פוליגון a', 'active'],
      ['b', 'פוליגון b', 'completed'],
    ]);
    expect(area.bounds).toEqual([35, 31.69, 35.03, 31.72]);
  });

  it("draws the searcher's own polygon selected", () => {
    const ring: [number, number][] = [
      [35, 31.7],
      [35.01, 31.7],
      [35.01, 31.71],
      [35, 31.7],
    ];
    const area = toMissionArea([polygon('a', ring), polygon('b', ring)], undefined, 'b');
    expect(area.data.polygons.map((p) => p.selected)).toEqual([false, true]);
  });

  it('adds the LKP and the rally point of the mission and frames them too', () => {
    const observedAt = '2026-10-03T13:05:00+03:00';
    const area = toMissionArea([], {
      lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt },
      rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
    });

    expect(area.data.lkp).toEqual({ id: 'lkp', position: [35.137, 31.769], time: formatTime(observedAt) });
    expect(area.data.rally).toEqual([35.13, 31.78]);
    expect(area.data.units).toEqual([]);
    expect(area.bounds).toEqual([35.13, 31.769, 35.137, 31.78]);
  });

  it('frames the surroundings of a rally point alone, while the mission has no LKP', () => {
    const area = toMissionArea([], { lkp: null, rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] } });
    expect(area.data.lkp).toBeNull();
    const [west, south, east, north] = area.bounds ?? [0, 0, 0, 0];
    expect(west).toBeLessThan(35.13);
    expect(east).toBeGreaterThan(35.13);
    expect(south).toBeLessThan(31.78);
    expect(north).toBeGreaterThan(31.78);
  });
});
