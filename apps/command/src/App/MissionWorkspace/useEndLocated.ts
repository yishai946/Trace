import { canEndMissionLocated } from '@trace/domain';
import type { LngLat } from '@trace/geo';
import type { EndMissionLocatedBody, Mission } from '@trace/schemas';
import { useState } from 'react';
import type { PlaceMode } from '../../map/PlacePicker';
import { endLocatedErrorMessage } from '../../mission/endLocatedErrorMessage';
import { useEndMissionLocated } from '../../mission/missionQueries';

/** Ending the mission as "the missing person was located" (UC-C16) from the mission control panel. */
export function useEndLocated(mission: Mission, online: boolean) {
  const end = useEndMissionLocated(mission.id);
  const [point, setPoint] = useState<LngLat | null>(null);
  const [mode, setMode] = useState<PlaceMode>('map');
  const [error, setError] = useState<string | null>(null);
  const open = canEndMissionLocated(mission.status);

  return {
    point,
    setPoint,
    mode,
    setMode,
    error,
    clearError: () => setError(null),
    offline: !online,
    busy: end.isPending,
    /** A click on the map sets the place while the form asks for one. */
    placesOnMap: open && mode === 'map' && !end.isPending,
    end: (body: EndMissionLocatedBody) => {
      setError(null);
      end.mutate(body, { onError: (e) => setError(endLocatedErrorMessage(e)) });
    },
  };
}
