import type { MissionPolygon } from '@trace/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { judgeFixes, noteLocalPresence, parseTolerance } from '.';
import { useSession } from '../../state/session';

const saved = vi.hoisted(() => ({ polygons: null as unknown }));
vi.mock('../../offline/store', () => ({
  loadStep: vi.fn(async () => saved.polygons),
  clearOfflinePackages: vi.fn(),
}));

const polygonId = '00000000-0000-4000-8000-0000000000a1';
const missionId = '00000000-0000-4000-8000-000000000001';
const square: MissionPolygon['geometry'] = {
  type: 'Polygon',
  coordinates: [
    [
      [35.0, 31.0],
      [35.01, 31.0],
      [35.01, 31.01],
      [35.0, 31.01],
      [35.0, 31.0],
    ],
  ],
};
const fix = (longitude: number, latitude: number, minute = 0) => ({
  coords: { latitude, longitude, accuracy: 5 },
  timestamp: Date.UTC(2026, 9, 3, 10, minute),
});
const inside = fix(35.005, 31.005, 1);
const outside = fix(35.02, 31.005, 2);

describe('parseTolerance', () => {
  it('has no default: a missing, empty or invalid value is 0, the exact boundary', () => {
    expect(parseTolerance(undefined)).toBe(0);
    expect(parseTolerance('')).toBe(0);
    expect(parseTolerance('abc')).toBe(0);
    expect(parseTolerance('-3')).toBe(0);
  });

  it('reads a configured margin in meters', () => {
    expect(parseTolerance('12.5')).toBe(12.5);
  });
});

describe('judgeFixes', () => {
  it('is outside when the newest fix is beyond the polygon, and inside when it is within', () => {
    expect(judgeFixes({ fixes: [inside, outside], polygon: square, toleranceMeters: 0, wasOutside: false })).toBe(true);
    expect(
      judgeFixes({ fixes: [outside, fix(35.005, 31.005, 3)], polygon: square, toleranceMeters: 0, wasOutside: true }),
    ).toBe(false);
  });

  it('judges by the newest fix whatever the order of the batch', () => {
    const batch = [fix(35.02, 31.005, 5), fix(35.005, 31.005, 1)];
    expect(judgeFixes({ fixes: batch, polygon: square, toleranceMeters: 0, wasOutside: false })).toBe(true);
  });

  it('keeps the state inside the GPS tolerance, and keeps it while it persists', () => {
    const near = fix(35.0101, 31.005); // about 10 m outside the east edge
    expect(judgeFixes({ fixes: [near], polygon: square, toleranceMeters: 50, wasOutside: false })).toBe(false);
    expect(judgeFixes({ fixes: [outside], polygon: square, toleranceMeters: 0, wasOutside: true })).toBe(true);
  });

  it('keeps the previous state when there are no fixes', () => {
    expect(judgeFixes({ fixes: [], polygon: square, toleranceMeters: 0, wasOutside: true })).toBe(true);
  });
});

describe('noteLocalPresence', () => {
  const assigned = {
    id: '00000000-0000-4000-8000-000000000002',
    callsign: 4,
    status: 'assigned' as const,
    polygonId,
    taskStatus: 'searching' as const,
  };
  beforeEach(() => {
    saved.polygons = [
      {
        id: polygonId,
        missionId,
        name: 'A',
        status: 'unsearched',
        coverage: null,
        activeSearchers: 1,
        geometry: square,
      },
    ];
    useSession.setState({ ...useSession.getInitialState(), missionId, participation: assigned, tracking: true });
  });

  it('flags leaving the polygon while Searching, offline included, and clears on return', async () => {
    await noteLocalPresence([outside]);
    expect(useSession.getState().outsidePolygon).toBe(true);
    await noteLocalPresence([inside]);
    expect(useSession.getState().outsidePolygon).toBe(false);
  });

  it('raises nothing when not Searching, without a polygon, or without a saved polygon', async () => {
    useSession.setState({ participation: { ...assigned, taskStatus: 'paused' } });
    await noteLocalPresence([outside]);
    expect(useSession.getState().outsidePolygon).toBe(false);

    useSession.setState({ participation: { ...assigned, polygonId: null } });
    await noteLocalPresence([outside]);
    expect(useSession.getState().outsidePolygon).toBe(false);

    useSession.setState({ participation: assigned });
    saved.polygons = null;
    await noteLocalPresence([outside]);
    expect(useSession.getState().outsidePolygon).toBe(false);
  });

  it('clears a warning that no longer applies once the searcher stops Searching', async () => {
    await noteLocalPresence([outside]);
    useSession.setState({ participation: { ...assigned, taskStatus: 'paused' } });
    await noteLocalPresence([outside]);
    expect(useSession.getState().outsidePolygon).toBe(false);
  });

  it('drops a judgement that finished after the searcher paused or moved polygon', async () => {
    const { loadStep } = await import('../../offline/store');
    vi.mocked(loadStep).mockImplementationOnce(async () => {
      useSession.setState({ participation: { ...assigned, taskStatus: 'paused' }, outsidePolygon: false });
      return saved.polygons as never;
    });
    await noteLocalPresence([outside]);
    expect(useSession.getState().outsidePolygon).toBe(false);
  });
});
