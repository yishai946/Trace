import { useQuery } from '@tanstack/react-query';
import { Mission, MissionPolygonList } from '@trace/schemas';
import { useSession } from '../../state/session';
import { loadPhoto, loadStep, type OfflineStep } from '../store';
import { photoDataUri } from '../photoDataUri';

const key = (missionId: string | null, step: OfflineStep) => ['offline', 'saved', missionId, step] as const;

/** Reads one saved step; the device being unreadable counts as nothing saved. */
function useSaved<T>(step: OfflineStep, read: (missionId: string) => Promise<T | null>) {
  const missionId = useSession((s) => s.missionId);
  return useQuery({
    queryKey: key(missionId, step),
    queryFn: () => (missionId ? read(missionId).catch(() => null) : null),
    enabled: !!missionId,
    // A copy on the phone only changes when a download saves it; screens ask the server for anything newer.
    staleTime: Infinity,
    retry: false,
  });
}

/** The mission saved on the phone (UC-F04): the missing person's details, LKP and rally point. */
export const useSavedMission = () => useSaved('mission', (id) => loadStep(id, 'mission', Mission));

/** The polygons saved on the phone (UC-F04). */
export const useSavedPolygons = () => useSaved('polygons', (id) => loadStep(id, 'polygons', MissionPolygonList));

/** The missing person's photo saved on the phone, as an address an image can show; null when there is none. */
export const useSavedPhotoUri = () =>
  useSaved('photo', async (id) => {
    const photo = await loadPhoto(id);
    return photo ? photoDataUri(photo) : null;
  });
