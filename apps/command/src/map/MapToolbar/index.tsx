import type { TerrainOptions } from '@trace/map';
import { Separator, Toolbar } from 'react-aria-components';
import styles from './MapToolbar.module.css';
import { ToolButton } from '../ToolButton';

export type MapTool = 'select' | 'polygon';

interface MapToolbarProps {
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
  terrain: TerrainOptions;
  onTerrainChange: (terrain: TerrainOptions) => void;
}

const icon = (path: string) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinejoin="round"
  >
    <path d={path} />
  </svg>
);

/** Trace Console MapToolbar: editing tools, then view layers. Floats at the bottom center of the map. */
export function MapToolbar({ tool, onToolChange, terrain, onTerrainChange }: MapToolbarProps) {
  const toggle = (key: keyof TerrainOptions) => onTerrainChange({ ...terrain, [key]: !terrain[key] });

  return (
    <Toolbar aria-label="כלי מפה" className={styles.toolbar}>
      <ToolButton aria-label="בחירה" isSelected={tool === 'select'} onChange={() => onToolChange('select')}>
        {icon('M5 3l14 7-6 2-2 6z')}
      </ToolButton>
      <ToolButton
        aria-label="ציור פוליגון"
        isSelected={tool === 'polygon'}
        onChange={(on) => onToolChange(on ? 'polygon' : 'select')}
      >
        {icon('M5 6l7-3 8 5-2 10-11 2-3-8z')}
      </ToolButton>
      <Separator orientation="vertical" className={styles.separator} />
      <ToolButton aria-label="הצללת תבליט" isSelected={terrain.hillshade} onChange={() => toggle('hillshade')}>
        {icon('M2 20l7-12 4 6 3-4 6 10z')}
      </ToolButton>
      <ToolButton aria-label="קווי גובה" isSelected={terrain.contours} onChange={() => toggle('contours')}>
        {icon('M3 17c3-4 6-4 9 0s6 4 9 0M3 11c3-4 6-4 9 0s6 4 9 0M7 5c2-2 3-2 5 0s3 2 5 0')}
      </ToolButton>
      <ToolButton aria-label="תלת-ממד" isSelected={terrain.terrain3d} onChange={() => toggle('terrain3d')}>
        {icon('M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5')}
      </ToolButton>
    </Toolbar>
  );
}
