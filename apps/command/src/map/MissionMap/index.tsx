import { formatItm, formatLatLng, toItm, type Bounds, type LngLat, type Polygon } from '@trace/geo';
import type { ThemeId } from '@trace/design';
import { themes } from '@trace/design';
import {
  buildMapStyle,
  toMissionSources,
  type MapProvider,
  type MissionMapData,
  type TerrainOptions,
} from '@trace/map';
import { Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl';
import '../maplibre-worker';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
  type HexColor,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { Button } from '../../components/Button';
import { preloadMapIcons, registerMapIcons } from '../icons';
import { MapToolbar, type MapTool } from '../MapToolbar';
import styles from './MissionMap.module.css';
import { getWebTerrainSources } from '../provider';

export interface MapFocus {
  center: LngLat;
  bounds?: Bounds;
}

interface MissionMapProps {
  provider: MapProvider;
  themeId: ThemeId;
  data: MissionMapData;
  /** Where the map opens. `bounds`, when given, wins over center and zoom. */
  initialView: { center: LngLat; zoom: number; bounds?: Bounds };
  /** Moves the map, e.g. to a place-search result. A new object triggers a new move. */
  focus?: MapFocus | null;
  /** A polygon finished in drawing mode. */
  onPolygonDrawn?: (polygon: Polygon) => void;
  /** A click on a mission polygon in selection mode, or null for a click on empty map. */
  onPolygonSelect?: (polygonId: string | null) => void;
  /** The polygon whose boundary is being reshaped. Its vertices become draggable until this is null again. */
  editing?: { polygonId: string; geometry: Polygon } | null;
  /** The reshaped boundary after each vertex move. */
  onEditChange?: (geometry: Polygon) => void;
  /** Tools, zoom buttons and cursor coordinates. Off for the map behind the login and mission list screens. */
  controls?: boolean;
}

const DRAW_PREFIX = 'td';
const POLYGON_FILL_LAYER = 'mission-polygon-fill';
/** Screen pixels kept free around a place when zooming to it: camera behavior, not a design value. */
const FIT_BOUNDS_PADDING_PX = 80;

function drawStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    fillColor: c.accent as HexColor,
    fillOpacity: 0.12,
    outlineColor: c.accent as HexColor,
    outlineWidth: 2,
    closingPointColor: c.accent as HexColor,
    closingPointOutlineColor: c.mapHalo as HexColor,
    closingPointWidth: 5,
    closingPointOutlineWidth: 2,
  };
}

function selectStyles(themeId: ThemeId) {
  const c = themes[themeId].color;
  return {
    selectedPolygonColor: c.accent as HexColor,
    selectedPolygonFillOpacity: 0.16,
    selectedPolygonOutlineColor: c.accent as HexColor,
    selectedPolygonOutlineWidth: 2.4,
    selectionPointColor: c.accent as HexColor,
    selectionPointOutlineColor: c.mapHalo as HexColor,
    selectionPointWidth: 5,
    selectionPointOutlineWidth: 2,
    midPointColor: c.mapHalo as HexColor,
    midPointOutlineColor: c.accent as HexColor,
    midPointWidth: 3.5,
    midPointOutlineWidth: 1.5,
  };
}

/** The mission map: Trace Console base map, mission overlays, terrain layers, polygon drawing and coordinates. */
export function MissionMap({
  provider,
  themeId,
  data,
  initialView,
  focus,
  onPolygonDrawn,
  onPolygonSelect,
  editing,
  onEditChange,
  controls = true,
}: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  // Latest props for map callbacks that are registered once.
  const dataRef = useRef(data);
  const onDrawnRef = useRef(onPolygonDrawn);
  const onSelectRef = useRef(onPolygonSelect);
  const onEditChangeRef = useRef(onEditChange);
  const editFeatureRef = useRef<string | null>(null);
  const toolRef = useRef<MapTool>('select');

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<MapTool>('select');
  const [terrain, setTerrain] = useState<TerrainOptions>({ hillshade: true, contours: true, terrain3d: false });
  const [cursor, setCursor] = useState<LngLat | null>(null);
  useLayoutEffect(() => {
    dataRef.current = data;
    onDrawnRef.current = onPolygonDrawn;
    onSelectRef.current = onPolygonSelect;
    onEditChangeRef.current = onEditChange;
    toolRef.current = tool;
  });

  const style = () => {
    const web = getWebTerrainSources(provider);
    return buildMapStyle({ themeId, provider, terrain, data: dataRef.current, ...web });
  };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    void preloadMapIcons().then(() => {
      if (cancelled || !containerRef.current) return;
      const created = new MapLibreMap({
        container: containerRef.current,
        style: style(),
        center: initialView.center,
        zoom: initialView.zoom,
        ...(initialView.bounds
          ? { bounds: initialView.bounds, fitBoundsOptions: { padding: FIT_BOUNDS_PADDING_PX, maxZoom: 15 } }
          : {}),
        maxPitch: 70,
        attributionControl: { compact: true },
      });
      map = created;
      mapRef.current = created;
      registerMapIcons(created);

      let frame = 0;
      created.on('mousemove', (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setCursor([e.lngLat.lng, e.lngLat.lat]));
      });
      created.on('mouseout', () => setCursor(null));

      // Selecting polygons: only with the selection tool, and not while a boundary is being reshaped.
      const selecting = () => toolRef.current === 'select' && !editFeatureRef.current;
      created.on('click', (e) => {
        if (!selecting()) return;
        const [hit] = created.queryRenderedFeatures(e.point, { layers: [POLYGON_FILL_LAYER] });
        const id = hit?.properties?.id;
        onSelectRef.current?.(typeof id === 'string' ? id : null);
      });
      created.on('mousemove', POLYGON_FILL_LAYER, () => {
        if (selecting()) created.getCanvas().style.cursor = 'pointer';
      });
      created.on('mouseleave', POLYGON_FILL_LAYER, () => {
        if (selecting()) created.getCanvas().style.cursor = '';
      });

      created.once('load', () => {
        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map: created, prefixId: DRAW_PREFIX }),
          modes: [
            new TerraDrawPolygonMode({
              styles: drawStyles(themeId),
              validation: (feature, { updateType }) =>
                updateType === 'finish' || updateType === 'commit'
                  ? ValidateNotSelfIntersecting(feature)
                  : { valid: true },
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
        drawRef.current = draw;
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      drawRef.current?.stop();
      drawRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme and terrain change the style. Keep Terra Draw's own layers across the swap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(style(), {
      diff: true,
      transformStyle: (previous, next) => ({
        ...next,
        sources: {
          ...next.sources,
          ...Object.fromEntries(Object.entries(previous?.sources ?? {}).filter(([id]) => id.startsWith(DRAW_PREFIX))),
        },
        layers: [...next.layers, ...(previous?.layers ?? []).filter((l) => l.id.startsWith(DRAW_PREFIX))],
      }),
    });
    drawRef.current?.updateModeOptions<typeof TerraDrawPolygonMode>('polygon', { styles: drawStyles(themeId) });
    drawRef.current?.updateModeOptions<typeof TerraDrawSelectMode>('select', { styles: selectStyles(themeId) });
    map.easeTo({ pitch: terrain.terrain3d ? 55 : 0, duration: 600 });
    // style() reads the current props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, themeId, terrain]);

  // Mission data updates only replace the overlay sources' data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [id, collection] of Object.entries(toMissionSources(data))) {
      (map.getSource(id) as GeoJSONSource | undefined)?.setData(collection);
    }
  }, [ready, data]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, editingId]);

  // While editing, the effect above owns the mode.
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !ready || editingId) return;
    draw.setMode(tool === 'polygon' ? 'polygon' : 'static');
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = tool === 'polygon' ? 'crosshair' : '';
  }, [ready, tool, editingId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    if (focus.bounds) map.fitBounds(focus.bounds, { padding: FIT_BOUNDS_PADDING_PX, maxZoom: 15, duration: 900 });
    else map.flyTo({ center: focus.center, zoom: 14, duration: 900 });
  }, [ready, focus]);

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.map} data-tool={tool} aria-label="מפת המסע" role="region" />

      {controls && (
        <>
          <div className={styles.toolbar}>
            <MapToolbar
              tool={tool}
              onToolChange={setTool}
              drawingDisabled={!!editingId || !onPolygonDrawn}
              terrain={terrain}
              onTerrainChange={setTerrain}
            />
          </div>

          <div className={styles.zoom}>
            <Button variant="icon" aria-label="התקרב" onPress={() => mapRef.current?.zoomIn()}>
              +
            </Button>
            <Button variant="icon" aria-label="התרחק" onPress={() => mapRef.current?.zoomOut()}>
              −
            </Button>
          </div>
        </>
      )}

      {controls && cursor && (
        <output className={styles.coords} aria-live="off">
          <span>{formatLatLng(cursor)}</span>
          <span className={styles.itm}>ITM {formatItm(toItm(cursor))}</span>
        </output>
      )}

      {tool === 'polygon' && !editingId && (
        <p className={styles.hint}>לחץ על המפה להוספת נקודות. לחץ על הנקודה הראשונה לסגירה.</p>
      )}
    </div>
  );
}
