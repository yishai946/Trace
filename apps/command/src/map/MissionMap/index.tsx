import type { Bounds, LngLat, Polygon } from '@trace/geo';
import type { ThemeId } from '@trace/design';
import { buildMapStyle, type MapProvider, type MissionMapData, type TerrainOptions } from '@trace/map';
import { Map as MapLibreMap } from 'maplibre-gl';
import '../maplibre-worker';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TerraDraw } from 'terra-draw';
import { preloadMapIcons, registerMapIcons } from '../icons';
import type { MapTool } from '../MapToolbar';
import { bindMapEvents } from './mapEvents';
import { MapControls } from './MapControls';
import { FIT_BOUNDS_PADDING_PX, useMapSync } from './useMapSync';
import { useDrawMode } from './useDrawMode';
import { createDraw } from './createDraw';
import styles from './MissionMap.module.css';
import { getWebTerrainSources } from '../provider';

export interface MapFocus {
  center: LngLat;
  bounds?: Bounds;
}

/** What a click on an LKP, sighting or report symbol hit. The current LKP has the id `lkp`. */
export interface PointTarget {
  kind: 'lkp' | 'sighting' | 'report';
  id: string;
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
  /** A click on the map while placing a point, such as the LKP or rally point. Turns off polygon selection. */
  onMapClick?: (point: LngLat) => void;
  /** A click on an LKP or sighting symbol in selection mode. */
  onPointSelect?: (target: PointTarget) => void;
  /** Starts or ends adding a sighting from the toolbar. Without it that tool is disabled. */
  onSighting?: () => void;
  sightingActive?: boolean;
  /** Tools, zoom buttons and cursor coordinates. Off for the map behind the login and mission list screens. */
  controls?: boolean;
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
  onMapClick,
  onPointSelect,
  onSighting,
  sightingActive,
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
  const onMapClickRef = useRef(onMapClick);
  const onPointSelectRef = useRef(onPointSelect);
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
    onMapClickRef.current = onMapClick;
    onPointSelectRef.current = onPointSelect;
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

      bindMapEvents(created, { toolRef, editFeatureRef, onMapClickRef, onPointSelectRef, onSelectRef }, setCursor);

      created.once('load', () => {
        const draw = createDraw(created, themeId, { editFeatureRef, onEditChangeRef, onDrawnRef });
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

  useMapSync({ mapRef, drawRef, ready, themeId, terrain, data, focus, style });

  const editingId = editing?.polygonId ?? null;
  const placing = !!onMapClick;
  useDrawMode({ drawRef, mapRef, editFeatureRef, ready, editing, tool, placing });

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.map} data-tool={tool} aria-label="מפת המסע" role="region" />

      {controls && (
        <MapControls
          tool={tool}
          onToolChange={setTool}
          drawingDisabled={!!editingId || !onPolygonDrawn || placing}
          onSighting={onSighting}
          sightingActive={sightingActive}
          terrain={terrain}
          onTerrainChange={setTerrain}
          cursor={cursor}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
        />
      )}

      {tool === 'polygon' && !editingId && (
        <p className={styles.hint}>לחץ על המפה להוספת נקודות. לחץ על הנקודה הראשונה לסגירה.</p>
      )}
    </div>
  );
}
