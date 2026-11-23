import { formatItm, formatLatLng, toItm, type LngLat } from '@trace/geo';
import type { MapView, TerrainOptions } from '@trace/map';
import { Button } from '../../components/Button';
import { MapLayersControl } from '../MapLayersControl';
import { MapToolbar, type MapTool } from '../MapToolbar';
import { ActionButton } from '../ToolButton/ActionButton';
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
  satelliteAvailable: boolean;
  /** Flies back to the search area. Without it (nothing to go to) the button is disabled. */
  onSearchArea: (() => void) | undefined;
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
  view,
  onViewChange,
  satelliteAvailable,
  onSearchArea,
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
          viewTools={
            <>
              <MapLayersControl view={view} onChange={onViewChange} satelliteAvailable={satelliteAvailable} />
              <ActionButton aria-label="חזרה לאזור החיפוש" isDisabled={!onSearchArea} onPress={onSearchArea}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </ActionButton>
            </>
          }
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
