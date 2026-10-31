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
import './maplibre-worker';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TerraDraw, TerraDrawPolygonMode, ValidateNotSelfIntersecting, type HexColor } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { Button } from '../components/Button';
import { preloadMapIcons, registerMapIcons } from './icons';
import { MapToolbar, type MapTool } from './MapToolbar';
import styles from './MissionMap.module.css';
import { getWebTerrainSources } from './provider';

export interface MapFocus {
  center: LngLat;
  bounds?: Bounds;
}

interface MissionMapProps {
  provider: MapProvider;
  themeId: ThemeId;
  data: MissionMapData;
  initialView: { center: LngLat; zoom: number };
  /** Moves the map, e.g. to a place-search result. A new object triggers a new move. */
  focus?: MapFocus | null;
  /** A polygon finished in drawing mode. */
  onPolygonDrawn?: (polygon: Polygon) => void;
}

const DRAW_PREFIX = 'td';
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

/** The mission map: Trace Console base map, mission overlays, terrain layers, polygon drawing and coordinates. */
export function MissionMap({ provider, themeId, data, initialView, focus, onPolygonDrawn }: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  // Latest props for map callbacks that are registered once.
  const dataRef = useRef(data);
  const onDrawnRef = useRef(onPolygonDrawn);
  useLayoutEffect(() => {
    dataRef.current = data;
    onDrawnRef.current = onPolygonDrawn;
  });

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<MapTool>('select');
  const [terrain, setTerrain] = useState<TerrainOptions>({ hillshade: true, contours: true, terrain3d: false });
  const [cursor, setCursor] = useState<LngLat | null>(null);

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
          ],
        });
        draw.start();
        draw.on('finish', (id) => {
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

  useEffect(() => {
    drawRef.current?.setMode(tool === 'polygon' ? 'polygon' : 'static');
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = tool === 'polygon' ? 'crosshair' : '';
  }, [ready, tool]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    if (focus.bounds) map.fitBounds(focus.bounds, { padding: FIT_BOUNDS_PADDING_PX, maxZoom: 15, duration: 900 });
    else map.flyTo({ center: focus.center, zoom: 14, duration: 900 });
  }, [ready, focus]);

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.map} data-tool={tool} aria-label="מפת המסע" role="region" />

      <div className={styles.toolbar}>
        <MapToolbar tool={tool} onToolChange={setTool} terrain={terrain} onTerrainChange={setTerrain} />
      </div>

      <div className={styles.zoom}>
        <Button variant="icon" aria-label="התקרב" onPress={() => mapRef.current?.zoomIn()}>
          +
        </Button>
        <Button variant="icon" aria-label="התרחק" onPress={() => mapRef.current?.zoomOut()}>
          −
        </Button>
      </div>

      {cursor && (
        <output className={styles.coords} aria-live="off">
          <span>{formatLatLng(cursor)}</span>
          <span className={styles.itm}>ITM {formatItm(toItm(cursor))}</span>
        </output>
      )}

      {tool === 'polygon' && <p className={styles.hint}>לחץ על המפה להוספת נקודות. לחץ על הנקודה הראשונה לסגירה.</p>}
    </div>
  );
}
