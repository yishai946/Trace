import { Redirect, useRouter } from 'expo-router';
import { SightingForm } from '../components/SightingForm';
import { useMission, useMissionPolygons } from '../mission/queries';
import { goBackOr } from '../navigation/navigate';
import { routes } from '../navigation/routes';
import { useSession } from '../state/session';

/** Fm09: report a sighting of the missing person (UC-F10). Opened over the mission screens. */
export default function SightingScreen() {
  const router = useRouter();
  const missionId = useSession((s) => s.missionId);
  const participation = useSession((s) => s.participation);
  const mission = useMission();
  const polygons = useMissionPolygons();
  const close = () => goBackOr(router, routes.map);

  // Without a mission there is nothing to report on: the map says why (signed out, no mission, no server).
  if (!missionId) return <Redirect href={routes.map} />;
  return (
    <SightingForm
      missionId={missionId}
      mission={mission.data}
      polygons={polygons.data ?? []}
      assignedPolygonId={participation?.status === 'assigned' ? participation.polygonId : null}
      onCancel={close}
      onDone={close}
    />
  );
}
