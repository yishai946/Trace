import { canChangeRallyPoint } from '@trace/domain';
import type { LngLat } from '@trace/geo';
import type { Mission } from '@trace/schemas';
import { useState } from 'react';
import type { PlaceMode } from '../../map/PlacePicker';
import { useUpdateRallyPoint } from '../../mission/missionQueries';
import { rallyErrorMessage } from '../../mission/rallyErrorMessage';

/** Moving the mission's rally point (UC-C05) from the rally point panel. */
export function useRallyPointEdit(mission: Mission, online: boolean) {
  const update = useUpdateRallyPoint(mission.id);
  const [mode, setMode] = useState<PlaceMode>('map');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked: 'ended' | 'offline' | null = !canChangeRallyPoint(mission.status)
    ? 'ended'
    : !online
      ? 'offline'
      : null;

  return {
    mode,
    setMode,
    saved,
    error,
    blocked,
    busy: update.isPending,
    /** A click on the map moves the point: the panel is in map mode and nothing blocks the change. */
    placesOnMap: mode === 'map' && !blocked && !update.isPending,
    change: (point: LngLat) => {
      setSaved(false);
      setError(null);
      update.mutate(point, { onSuccess: () => setSaved(true), onError: (e) => setError(rallyErrorMessage(e)) });
    },
  };
}
