import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import styles from '../App.module.css';
import type { MapFocus } from '../../map/MissionMap';
import { RallyPointPanel } from '../../mission/RallyPointPanel';
import type { useRallyPointEdit } from './useRallyPointEdit';

interface RallyPointSlotProps {
  mission: Mission;
  provider: MapProvider;
  rally: ReturnType<typeof useRallyPointEdit>;
  onPlaceFound: (focus: MapFocus) => void;
  onClose: () => void;
}

/** The rally point panel in the corner of the map (UC-C05). */
export function RallyPointSlot({ mission, provider, rally, onPlaceFound, onClose }: RallyPointSlotProps) {
  return (
    <div className={styles.rallyPanel}>
      <RallyPointPanel
        provider={provider}
        point={mission.rallyPoint.coordinates}
        mode={rally.mode}
        onModeChange={rally.setMode}
        onChange={rally.change}
        onPlaceFound={(place) => onPlaceFound({ center: place.center, bounds: place.bounds })}
        busy={rally.busy}
        error={rally.error}
        saved={rally.saved}
        blocked={rally.blocked}
        onClose={onClose}
      />
    </div>
  );
}
