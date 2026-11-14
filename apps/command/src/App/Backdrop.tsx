import type { ThemeId } from '@trace/design';
import type { LngLat } from '@trace/geo';
import { emptyMissionMapData, type MapProvider } from '@trace/map';
import styles from './App.module.css';
import { MissionMap } from '../map/MissionMap';

/** Where the map opens when there is no mission yet: Jerusalem. */
const DEFAULT_CENTER: LngLat = [35.2137, 31.7683];

interface BackdropProps {
  provider: MapProvider;
  themeId: ThemeId;
  veil: 'light' | 'dense';
}

/** The map behind the login and mission list screens, under a veil of the map ground colour. */
export function Backdrop({ provider, themeId, veil }: BackdropProps) {
  return (
    <>
      <MissionMap
        provider={provider}
        themeId={themeId}
        data={emptyMissionMapData}
        initialView={{ center: DEFAULT_CENTER, zoom: 12 }}
        focus={null}
        controls={false}
      />
      <div className={styles.veil} data-veil={veil} aria-hidden="true" />
    </>
  );
}
