import type { LngLat, Polygon } from '@trace/geo';
import type { MissionMapData } from '@trace/map';

// Sample data until the API serves missions: a search in the Jerusalem hills, west of Ein Kerem.
export const SAMPLE_CENTER: LngLat = [35.137, 31.766];

const box = (west: number, south: number, east: number, north: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

export const sampleMission: MissionMapData = {
  polygons: [
    { id: 'A', letter: 'A', status: 'active', coverage: 82, geometry: box(35.122, 31.77, 35.136, 31.781) },
    { id: 'B', letter: 'B', status: 'active', coverage: 41, geometry: box(35.138, 31.77, 35.152, 31.781) },
    { id: 'C', letter: 'C', status: 'completed', coverage: 91, geometry: box(35.122, 31.756, 35.136, 31.768) },
    { id: 'D', letter: 'D', status: 'unassigned', coverage: null, geometry: box(35.138, 31.756, 35.152, 31.768) },
  ],
  units: [
    { id: 'u4', callsign: 4, state: 'normal', position: [35.128, 31.775] },
    { id: 'u3', callsign: 3, state: 'warning', position: [35.1205, 31.7765] },
    { id: 'u7', callsign: 7, state: 'sos', position: [35.145, 31.774] },
    { id: 'u9', callsign: 9, state: 'offline', position: [35.149, 31.779] },
  ],
  tracks: [
    {
      unitId: 'u4',
      positions: [
        [35.124, 31.772],
        [35.126, 31.7735],
        [35.125, 31.775],
        [35.128, 31.775],
      ],
    },
    {
      unitId: 'u7',
      positions: [
        [35.14, 31.771],
        [35.142, 31.7725],
        [35.1435, 31.772],
        [35.145, 31.774],
      ],
    },
  ],
  lkp: { id: 'lkp', position: [35.137, 31.769], time: '13:05' },
  lkpHistory: [{ id: 'lkp-0', position: [35.131, 31.763] }],
  sightings: [{ id: 's1', position: [35.141, 31.778], time: '15:40' }],
  rally: [35.1335, 31.7835],
  reports: [
    { id: 'r1', position: [35.147, 31.7745], hazard: true },
    { id: 'r2', position: [35.13, 31.778], hazard: false },
  ],
};
