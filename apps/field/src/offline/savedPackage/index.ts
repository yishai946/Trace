import { useQuery } from '@tanstack/react-query';
import { Mission, MissionPolygonList, ReportList } from '@trace/schemas';
import { useSession } from '../../state/session';
import { useOfflineState } from '../state';
import { loadPhoto, loadStep, type OfflineStep } from '../store';
import { photoDataUri } from '../photoDataUri';

const key = (missionId: string | null, step: OfflineStep) => ['offline', 'saved', missionId, step] as const;

/** Reads one saved step; the device being unreadable counts as nothing saved. */
function useSaved<T>(step: OfflineStep, read: (missionId: string) => Promise<T | null>) {
  const missionId = useSession((s) => s.missionId);
  // The steps saved so far are part of the key, so a download or a clear makes the screens read the phone again.
  const savedNow = useOfflineState((s) => s.saved.join());
  return useQuery({
    queryKey: [...key(missionId, step), savedNow],
    queryFn: () => (missionId ? read(missionId).catch(() => null) : null),
    enabled: !!missionId,
    // Always read what is on the phone now: a download or a clear changes it behind the cache.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/** The mission saved on the phone (UC-F04): the missing person's details, LKP and rally point. */
export const useSavedMission = () => useSaved('mission', (id) => loadStep(id, 'mission', Mission));

/** The polygons saved on the phone (UC-F04). */
export const useSavedPolygons = () => useSaved('polygons', (id) => loadStep(id, 'polygons', MissionPolygonList));

/** The reports list saved on the phone (UC-F11): what the searcher last saw of their polygon and their own. */
export const useSavedReports = () => useSaved('reports', (id) => loadStep(id, 'reports', ReportList));

/** The missing person's photo saved on the phone, as an address an image can show; null when there is none. */
export const useSavedPhotoUri = () =>
  useSaved('photo', async (id) => {
    const photo = await loadPhoto(id);
    return photo ? photoDataUri(photo) : null;
  });
