import { canEndMissionLocated } from '@trace/domain';
import type { LngLat } from '@trace/geo';
import type { EndMissionLocatedBody, Mission, StopMissionBody } from '@trace/schemas';
import { useState } from 'react';
import type { PlaceMode } from '../../map/PlacePicker';
import { endLocatedErrorMessage } from '../../mission/endLocatedErrorMessage';
import { pauseErrorMessage } from '../../mission/pauseErrorMessage';
import { useEndMissionLocated, useMissionPause, useStopMission } from '../../mission/missionQueries';

/** Ending the mission, as "the missing person was located" (UC-C16) or by stopping the search (UC-C17), from the mission control panel. */
export function useEndLocated(mission: Mission, online: boolean) {
  const end = useEndMissionLocated(mission.id);
  const stop = useStopMission(mission.id);
  const pause = useMissionPause(mission.id, 'pause');
  const resume = useMissionPause(mission.id, 'resume');
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
    busy: end.isPending || stop.isPending || pause.isPending || resume.isPending,
    /** A click on the map sets the place while the form asks for one. */
    placesOnMap: open && mode === 'map' && !end.isPending && !stop.isPending,
    end: (body: EndMissionLocatedBody) => {
      setError(null);
      end.mutate(body, { onError: (e) => setError(endLocatedErrorMessage(e)) });
    },
    pause: () => {
      setError(null);
      pause.mutate(undefined, { onError: (e) => setError(pauseErrorMessage(e)) });
    },
    resume: () => {
      setError(null);
      resume.mutate(undefined, { onError: (e) => setError(pauseErrorMessage(e)) });
    },
    stop: (body: StopMissionBody) => {
      setError(null);
      stop.mutate(body, { onError: (e) => setError(endLocatedErrorMessage(e, 'סיבת ההפסקה אינה תקינה.')) });
    },
  };
}
