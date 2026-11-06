import type { MissionPolygon } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { toMissionArea } from '.';

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
});
