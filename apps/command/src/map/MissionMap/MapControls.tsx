import { formatItm, formatLatLng, toItm, type LngLat } from '@trace/geo';
import type { TerrainOptions } from '@trace/map';
import { Button } from '../../components/Button';
import { MapToolbar, type MapTool } from '../MapToolbar';
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
  /** Where the pointer is on the map, if it is over it. */
  cursor: LngLat | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/** The map's tools, zoom buttons and the coordinates under the pointer. */
export function MapControls({
  tool,
  onToolChange,
  drawingDisabled,
  onSighting,
  sightingActive,
  terrain,
  onTerrainChange,
  cursor,
  onZoomIn,
  onZoomOut,
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

      <div className={styles.zoom}>
        <Button variant="icon" aria-label="התקרב" onPress={onZoomIn}>
          +
        </Button>
        <Button variant="icon" aria-label="התרחק" onPress={onZoomOut}>
          −
        </Button>
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
