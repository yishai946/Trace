import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import styles from '../App.module.css';
import type { MapFocus } from '../../map/MissionMap';
import { MissionControlPanel } from '../../mission/MissionControlPanel';
import type { useEndLocated } from './useEndLocated';

interface MissionControlSlotProps {
  mission: Mission;
  provider: MapProvider;
  control: ReturnType<typeof useEndLocated>;
  onPlaceFound: (focus: MapFocus) => void;
  onClose: () => void;
}

/** The mission control panel in the corner of the map, where the commander ends the mission (UC-C16). */
export function MissionControlSlot({ mission, provider, control, onPlaceFound, onClose }: MissionControlSlotProps) {
  return (
    <div className={styles.rallyPanel}>
      <MissionControlPanel
        mission={mission}
        provider={provider}
        point={control.point}
        mode={control.mode}
        onModeChange={control.setMode}
        onPoint={control.setPoint}
        onPlaceFound={(place) => onPlaceFound({ center: place.center, bounds: place.bounds })}
        busy={control.busy}
        error={control.error}
        offline={control.offline}
        onEnd={control.end}
        onEdit={control.clearError}
        onClose={onClose}
      />
    </div>
  );
}
