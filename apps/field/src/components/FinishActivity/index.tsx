import { useFinishActivity } from '../../mission/useFinishActivity';
import { useMission } from '../../mission/queries';
import { useSession } from '../../state/session';
import { FinishActivityControls } from '../FinishActivityControls';

/** "סיימתי פעילות…" for the signed-in searcher of the current mission (UC-F15); nothing once the activity ended. */
export function FinishActivity() {
  const status = useSession((s) => s.participation?.status);
  const mission = useMission();
  const { finish, pending, error } = useFinishActivity();
  if (!status || status === 'ended') return null;
  const rally = mission.data?.rallyPoint.coordinates;
  return (
    <FinishActivityControls
      rallyPoint={rally ? [rally[0], rally[1]] : null}
      onFinish={finish}
      pending={pending}
      error={error}
    />
  );
}
