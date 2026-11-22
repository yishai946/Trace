import { canStartSearch, type StartSearchReadiness } from '@trace/domain';
import { useSession } from '../../state/session';
import { offlineProgress, savedParts, type OfflineProgress } from '../progress';
import { useOfflineState } from '../state';

export type OfflineStatus = 'checking' | 'downloading' | 'interrupted' | 'ready';

export interface OfflinePackage {
  status: OfflineStatus;
  progress: OfflineProgress;
  /** Whether Start Search is open (decision 85): only with the whole package saved. */
  startSearch: StartSearchReadiness;
  /** An interrupted download that will not resume by itself. */
  refused: boolean;
  retry: () => void;
}

/** What the screens show of the offline package of the searcher's mission (UC-F03): progress and readiness. */
export function useOfflinePackage(): OfflinePackage {
  const missionId = useSession((s) => s.missionId);
  const state = useOfflineState();
  // State left from another mission says nothing about this one.
  const current = state.missionId === missionId && missionId !== null;
  const saved = current ? state.saved : [];
  const progress = offlineProgress(saved);
  const status: OfflineStatus =
    !current || !state.loaded
      ? 'checking'
      : progress.complete
        ? 'ready'
        : state.failed && !state.running
          ? 'interrupted'
          : 'downloading';
  return {
    status,
    progress,
    startSearch: canStartSearch(savedParts(saved)),
    refused: state.refused,
    retry: state.retry,
  };
}
