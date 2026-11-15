import type { Polygon } from '@trace/geo';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, type RefObject } from 'react';
import type { TerraDraw } from 'terra-draw';
import type { MapTool } from '../MapToolbar';

interface DrawModeInput {
  drawRef: RefObject<TerraDraw | null>;
  mapRef: RefObject<MapLibreMap | null>;
  /** Set to the id of the polygon being reshaped while editing, null otherwise. */
  editFeatureRef: RefObject<string | null>;
  ready: boolean;
  /** The polygon whose boundary is being reshaped. */
  editing: { polygonId: string; geometry: Polygon } | null | undefined;
  tool: MapTool;
  /** A click on the map places a point: the cursor is a crosshair. */
  placing: boolean;
}

/** What Terra Draw does for the current tool: drawing, reshaping a boundary, or nothing; and the cursor to match. */
export function useDrawMode({ drawRef, mapRef, editFeatureRef, ready, editing, tool, placing }: DrawModeInput) {
  // Boundary editing: the polygon moves into Terra Draw with draggable vertices while `editing` is set.
  const editingId = editing?.polygonId ?? null;
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !ready || !editing) return;
    const featureId = crypto.randomUUID();
    draw.addFeatures([{ id: featureId, type: 'Feature', geometry: editing.geometry, properties: { mode: 'polygon' } }]);
    editFeatureRef.current = featureId;
    draw.setMode('select');
    draw.selectFeature(featureId);
    return () => {
      editFeatureRef.current = null;
      if (draw.enabled) draw.removeFeatures([featureId]);
    };
    // Only a new polygon restarts editing; geometry updates come from the editor itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `editing` is read once per polygon: its geometry changes come from the editor
  }, [ready, editingId]);

  // While editing, the effect above owns the mode.
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !ready || editingId) return;
    draw.setMode(tool === 'polygon' ? 'polygon' : 'static');
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = tool === 'polygon' ? 'crosshair' : '';
  }, [drawRef, mapRef, ready, tool, editingId]);

  // Placing a point shows a crosshair over the whole map.
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas || !ready || tool !== 'select' || editingId) return;
    canvas.style.cursor = placing ? 'crosshair' : '';
  }, [mapRef, ready, placing, tool, editingId]);
}
