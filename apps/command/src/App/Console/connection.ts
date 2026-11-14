import type { Connection } from '../../components/ConnectionStatus';
import { useOnline } from '../../hooks/useOnline';
import { useHealth } from '../../mission/missionQueries';
import type { LiveState } from '../../realtime';

interface Network {
  online: boolean;
  /** New operational actions need both a network and a reachable server (UC-C01). */
  connected: boolean;
  /** The first check of the server has not answered yet. */
  checking: boolean;
}

export function useNetwork(): Network {
  const online = useOnline();
  const health = useHealth();
  return { online, connected: online && !health.isError, checking: health.isPending };
}

/**
 * What the connection indicator says: a dot and one word, always on screen, with the reason and its effect in the
 * tooltip and the accessible name. `live` is the open mission's realtime state, null with no mission open.
 */
export function connectionOf({ online, connected, checking }: Network, live: LiveState | null): Connection {
  if (!connected) {
    return {
      state: 'down',
      label: 'לא זמין',
      detail: online ? 'אין חיבור לשרת. פעולות חדשות חסומות.' : 'אין אינטרנט. פעולות חדשות חסומות.',
    };
  }
  if (checking || live === 'connecting') return { state: 'checking', label: 'בודק…', detail: 'בודק חיבור לשרת.' };
  if (live === 'down') {
    return {
      state: 'down',
      label: 'לא זמין',
      detail: 'העדכונים החיים מהשרת נקטעו. מתחבר מחדש; פעולות חדשות חסומות.',
    };
  }
  return { state: 'up', label: 'זמין', detail: live ? 'מחובר לשרת. המפה מתעדכנת בזמן אמת.' : 'מחובר לשרת.' };
}
