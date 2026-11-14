import type { ThemeId } from '@trace/design';
import type { Polygon } from '@trace/geo';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { RefObject } from 'react';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, ValidateNotSelfIntersecting } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { drawStyles, selectStyles } from './drawStyles';

export const DRAW_PREFIX = 'td';

interface DrawRefs {
  /** The polygon being reshaped, if any. */
  editFeatureRef: RefObject<string | null>;
  onEditChangeRef: RefObject<((geometry: Polygon) => void) | undefined>;
  onDrawnRef: RefObject<((polygon: Polygon) => void) | undefined>;
}

/** Terra Draw on the map: a polygon drawing mode and a selection mode with draggable vertices. */
export function createDraw(map: MapLibreMap, themeId: ThemeId, refs: DrawRefs): TerraDraw {
  const { editFeatureRef, onEditChangeRef, onDrawnRef } = refs;
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map: map, prefixId: DRAW_PREFIX }),
    modes: [
      new TerraDrawPolygonMode({
        styles: drawStyles(themeId),
        validation: (feature, { updateType }) =>
          updateType === 'finish' || updateType === 'commit' ? ValidateNotSelfIntersecting(feature) : { valid: true },
      }),
      new TerraDrawSelectMode({
        styles: selectStyles(themeId),
        allowManualSelection: false,
        allowManualDeselection: false,
        keyEvents: null,
        flags: {
          polygon: {
            feature: {
              draggable: false,
              selfIntersectable: false,
              coordinates: { draggable: true, midpoints: true, deletable: true },
            },
          },
        },
      }),
    ],
  });
  draw.start();
  draw.on('change', (ids, type) => {
    const editId = editFeatureRef.current;
    if (type !== 'update' || !editId || !ids.includes(editId)) return;
    const feature = draw.getSnapshotFeature(editId);
    if (feature?.geometry.type === 'Polygon') onEditChangeRef.current?.(feature.geometry as Polygon);
  });
  // Terra Draw also reports "finish" when a vertex drag ends in select mode; only drawing creates polygons.
  draw.on('finish', (id, { mode }) => {
    if (mode !== 'polygon') return;
    const feature = draw.getSnapshotFeature(id);
    draw.removeFeatures([id]);
    if (feature?.geometry.type === 'Polygon') onDrawnRef.current?.(feature.geometry as Polygon);
  });
  return draw;
}
