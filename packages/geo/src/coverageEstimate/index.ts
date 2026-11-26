import turfArea from '@turf/area';
import turfBuffer from '@turf/buffer';
import { featureCollection, lineString } from '@turf/helpers';
import turfIntersect from '@turf/intersect';
import turfUnion from '@turf/union';
import type { Feature, MultiPolygon, Polygon as GeoPolygon } from 'geojson';
import { areaSquareMeters, distanceMeters } from '../geometry';
import type { LngLat, Polygon } from '../types';

/** The Coverage Estimate parameters (decision 101, POC values that can be tuned after field tests). */
export const COVERAGE_BUFFER_METERS = 10;
export const COVERAGE_MAX_POINT_ACCURACY_METERS = 30;
export const COVERAGE_MAX_SEGMENT_SECONDS = 60;
export const COVERAGE_MAX_SPEED_METERS_PER_SECOND = 4;

export interface CoveragePoint {
  position: LngLat;
  /** Milliseconds since the epoch. */
  recordedAt: number;
  /** Meters, as the phone reported it; absent when it did not. */
  accuracy?: number | null;
  /** `search` while the searcher was Searching; anything else never counts (UC-S01, UC-S02). */
  context: 'search' | 'safety';
}

/** One searcher's points that belong to the polygon (those recorded while assigned to it, decisions 39 and 72). */
export interface CoverageRoute {
  points: readonly CoveragePoint[];
}

type Area = Feature<GeoPolygon | MultiPolygon>;

function isUsable(point: CoveragePoint): boolean {
  return (
    point.context === 'search' &&
    (point.accuracy === null || point.accuracy === undefined || point.accuracy <= COVERAGE_MAX_POINT_ACCURACY_METERS)
  );
}

function countsAsSegment(a: CoveragePoint, b: CoveragePoint): boolean {
  const seconds = (b.recordedAt - a.recordedAt) / 1000;
  if (seconds <= 0 || seconds > COVERAGE_MAX_SEGMENT_SECONDS) return false;
  return distanceMeters(a.position, b.position) / seconds <= COVERAGE_MAX_SPEED_METERS_PER_SECOND;
}

/**
 * The runs of consecutive counted segments of a route, each as a list of positions. A rejected point, a safety point,
 * a long gap or a GPS jump ends the run; the points stay in the stored route but contribute nothing here.
 */
function countedRuns(route: CoverageRoute): LngLat[][] {
  const ordered = [...route.points].sort((a, b) => a.recordedAt - b.recordedAt);
  const runs: LngLat[][] = [];
  let run: LngLat[] = [];
  let previous: CoveragePoint | null = null;
  for (const point of ordered) {
    if (!isUsable(point)) {
      previous = null;
      run = [];
      continue;
    }
    if (previous && countsAsSegment(previous, point)) {
      if (run.length === 0) {
        run = [previous.position];
        runs.push(run);
      }
      run.push(point.position);
    } else {
      run = [];
    }
    previous = point;
  }
  return runs;
}

/**
 * Coverage Estimate of one polygon, in whole percent (UC-S02, decisions 11, 39, 41, 57, 72, 101): the union of the
 * search strips (a 10 m buffer around every counted segment) of all the searchers, cut to the polygon, divided by the
 * polygon's area; capped at 100 and rounded down. Segments outside Searching, outside the polygon, paused, without a
 * usable GPS, with a long gap or an impossible speed do not count. The caller passes only points recorded while the
 * searcher was assigned to this polygon.
 */
export function coveragePercent(polygon: Polygon, routes: readonly CoverageRoute[]): number {
  const strips: Area[] = routes
    .flatMap(countedRuns)
    .map((run) => turfBuffer(lineString(run), COVERAGE_BUFFER_METERS, { units: 'meters' }))
    .filter((strip): strip is Area => strip !== undefined);
  const [first, ...others] = strips;
  if (!first) return 0;
  const united = others.length === 0 ? first : turfUnion(featureCollection([first, ...others]));
  const inside = united
    ? turfIntersect(featureCollection([united, { type: 'Feature', properties: {}, geometry: polygon }]))
    : null;
  if (!inside) return 0;
  const polygonArea = areaSquareMeters(polygon);
  if (polygonArea <= 0) return 0;
  const ratio = turfArea(inside) / polygonArea;
  return Math.min(100, Math.floor(ratio * 100 + 1e-6));
}
