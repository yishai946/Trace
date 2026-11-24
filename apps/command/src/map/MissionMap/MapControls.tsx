import { formatItm, formatLatLng, toItm, type LngLat } from '@trace/geo';
import type { ThemeId } from '@trace/design';
import type { MapView, TerrainOptions } from '@trace/map';
import { MapLayersControl } from '../MapLayersControl';
import { MapToolbar, type MapTool } from '../MapToolbar';
import { NavControls, type NavControlsProps } from './NavControls';
import styles from './MissionMap.module.css';

interface MapControlsProps {
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
  drawingDisabled: boolean;
  /** Starts or ends adding a sighting. Without it that tool is disabled. */
  onSighting: (() => void) | undefined;
  sightingActive: boolean | undefined;
  terrain: TerrainOptions;
  onTerrainChange: (terrain: TerrainOptions) => void;
  view: MapView;
  onViewChange: (view: MapView) => void;
  themeId: ThemeId;
  /** A satellite image tile for the layer picker, when the provider has imagery. */
  satelliteTile: string | undefined;
  nav: NavControlsProps;
  /** Where the pointer is on the map, if it is over it. */
  cursor: LngLat | null;
}

/** The map's tools, navigation column and the coordinates under the pointer. */
export function MapControls({
  tool,
  onToolChange,
  drawingDisabled,
  onSighting,
  sightingActive,
  terrain,
  onTerrainChange,
  view,
  onViewChange,
  themeId,
  satelliteTile,
  nav,
  cursor,
}: MapControlsProps) {
  return (
    <>
      <div className={styles.toolbar}>
        <MapToolbar
          tool={tool}
          onToolChange={onToolChange}
          drawingDisabled={drawingDisabled}
          onSighting={
            onSighting &&
            (() => {
              onToolChange('select');
              onSighting();
            })
          }
          sightingActive={sightingActive}
          terrain={terrain}
          onTerrainChange={onTerrainChange}
        />
      </div>

      <NavControls {...nav} />

      <div className={styles.layers}>
        <MapLayersControl view={view} onChange={onViewChange} themeId={themeId} satelliteTile={satelliteTile} />
      </div>

      {cursor && (
        <output className={styles.coords} aria-live="off">
          <span>{formatLatLng(cursor)}</span>
          <span className={styles.itm}>ITM {formatItm(toItm(cursor))}</span>
        </output>
      )}
    </>
  );
}
