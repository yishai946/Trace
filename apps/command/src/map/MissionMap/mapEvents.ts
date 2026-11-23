import type { LngLat } from '@trace/geo';
import type { MissionMapData } from '@trace/map';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { RefObject } from 'react';
import { pointFocus, polygonFocus } from '../focusTargets';
import type { MapTool } from '../MapToolbar';
import type { PointTarget } from '.';
import { moveMapTo } from './useMapSync';

const POLYGON_FILL_LAYER = 'mission-polygon-fill';
const SIGHTING_LAYER = 'mission-sightings';
const REPORT_LAYER = 'mission-reports';
const LKP_LAYER = 'mission-lkp';
const LKP_HISTORY_LAYER = 'mission-lkp-history';
const UNIT_LAYER = 'mission-units';
const POINT_LAYERS = [SIGHTING_LAYER, REPORT_LAYER, LKP_LAYER, LKP_HISTORY_LAYER, UNIT_LAYER];

interface MapEventRefs {
  dataRef: RefObject<MissionMapData>;
  toolRef: RefObject<MapTool>;
  /** The polygon being reshaped, if any. */
  editFeatureRef: RefObject<string | null>;
  onMapClickRef: RefObject<((point: LngLat) => void) | undefined>;
  onPointSelectRef: RefObject<((target: PointTarget) => void) | undefined>;
  onSelectRef: RefObject<((polygonId: string | null) => void) | undefined>;
}

/** What a click on a point symbol selected, from the layer it hit and the id in its properties. */
function pointTarget(layerId: string, id: unknown): PointTarget {
  if (layerId === SIGHTING_LAYER && typeof id === 'string') return { kind: 'sighting', id };
  if (layerId === REPORT_LAYER && typeof id === 'string') return { kind: 'report', id };
  if (layerId === UNIT_LAYER && typeof id === 'string') return { kind: 'searcher', id };
  return { kind: 'lkp', id: typeof id === 'string' ? id : 'lkp' };
}

/**
 * The cursor coordinates, clicks (placing a point, selecting a symbol or a polygon, which also flies the map to it)
 * and the pointer cursor.
 */
export function bindMapEvents(map: MapLibreMap, refs: MapEventRefs, onCursor: (cursor: LngLat | null) => void) {
  const { dataRef, toolRef, editFeatureRef, onMapClickRef, onPointSelectRef, onSelectRef } = refs;
  let frame = 0;
  map.on('mousemove', (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => onCursor([e.lngLat.lng, e.lngLat.lat]));
  });
  map.on('mouseout', () => onCursor(null));

  // Selecting polygons: only with the selection tool, and not while a boundary is being reshaped.
  const selecting = () => toolRef.current === 'select' && !editFeatureRef.current && !onMapClickRef.current;
  map.on('click', (e) => {
    if (onMapClickRef.current && toolRef.current === 'select') {
      onMapClickRef.current([e.lngLat.lng, e.lngLat.lat]);
      return;
    }
    if (!selecting()) return;
    const [point] = map.queryRenderedFeatures(e.point, { layers: POINT_LAYERS });
    if (point) {
      const target = pointTarget(point.layer.id, point.properties?.id);
      onPointSelectRef.current?.(target);
      const focus = pointFocus(dataRef.current, target);
      if (focus) moveMapTo(map, focus);
      return;
    }
    const [hit] = map.queryRenderedFeatures(e.point, { layers: [POLYGON_FILL_LAYER] });
    const id = hit?.properties?.id;
    onSelectRef.current?.(typeof id === 'string' ? id : null);
    const focus = typeof id === 'string' ? polygonFocus(dataRef.current, id) : null;
    if (focus) moveMapTo(map, focus);
  });
  for (const layer of [POLYGON_FILL_LAYER, ...POINT_LAYERS]) {
    map.on('mousemove', layer, () => {
      if (selecting()) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => {
      if (selecting()) map.getCanvas().style.cursor = '';
    });
  }
}
