import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../../state/session';
import { routes } from '../routes';

/** The commander ended the participation (UC-C18): from any tab, the searcher is taken to the map, which says so. */
export function useLeaveWhenRemoved(): void {
  const router = useRouter();
  const removed = useSession((s) => s.assignmentNotice?.kind === 'ended');
  useEffect(() => {
    if (removed) router.navigate(routes.map);
  }, [removed, router]);
}
