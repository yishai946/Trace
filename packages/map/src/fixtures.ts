import type { MissionMapData } from './data';

/** Mission data that exercises every overlay, shared by the package tests. */
export const sampleData: MissionMapData = {
  polygons: [
    {
      id: 'a',
      name: 'ואדי צפוני',
      status: 'active',
      coverage: 82.4,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [35, 31.7],
            [35.01, 31.7],
            [35.01, 31.71],
            [35, 31.7],
          ],
        ],
      },
    },
  ],
  units: [{ id: 'u7', callsign: 7, state: 'sos', position: [35.005, 31.705] }],
  tracks: [
    {
      unitId: 'u7',
      positions: [
        [35.001, 31.701],
        [35.005, 31.705],
      ],
    },
  ],
  lkp: { id: 'lkp', position: [35.004, 31.703], time: '13:05' },
  lkpHistory: [{ id: 'old', position: [35.002, 31.702], time: '12:10' }],
  sightings: [
    { id: 's1', position: [35.006, 31.706], time: '15:40', label: '1 15:40', suggested: true },
    { id: 's2', position: [35.003, 31.704], time: '14:22', label: '2 14:22' },
  ],
  rally: [34.999, 31.699],
  reports: [
    { id: 'r1', position: [35.007, 31.707], hazard: true },
    { id: 'r2', position: [35.012, 31.712], hazard: false, located: true, time: '16:51' },
  ],
};
