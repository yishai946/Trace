import { create } from 'zustand';
import type { OfflineStep } from '../store';

interface OfflineState {
  /** The mission this state is about. */
  missionId: string | null;
  /** The steps saved on the device for it. */
  saved: OfflineStep[];
  /** True once the device was asked what it holds, so "nothing saved" is not shown before that. */
  loaded: boolean;
  /** A download is running now. */
  running: boolean;
  /** The last download stopped before the package was complete, e.g. the connection dropped. */
  failed: boolean;
  /** The failure will not go away by waiting (a refusal, or the phone's storage), so nothing retries by itself. */
  refused: boolean;
  /** Bumped when a saved step was replaced by a newer copy, so screens read the phone again. */
  revision: number;
  /** Bumped by "try again"; the download hook runs again on a change. */
  attempt: number;
  start: (missionId: string) => void;
  setSaved: (saved: OfflineStep[]) => void;
  stepSaved: (step: OfflineStep) => void;
  setRunning: (running: boolean) => void;
  setFailed: (failed: boolean, refused?: boolean) => void;
  refreshed: (missionId: string) => void;
  retry: () => void;
}

/** The state of the current mission's offline package (UC-F03), shared by the download and the screens that show it. */
export const useOfflineState = create<OfflineState>()((set) => ({
  missionId: null,
  saved: [],
  loaded: false,
  running: false,
  failed: false,
  refused: false,
  revision: 0,
  attempt: 0,
  start: (missionId) => set({ missionId, saved: [], loaded: false, running: false, failed: false, refused: false }),
  setSaved: (saved) => set({ saved, loaded: true }),
  stepSaved: (step) => set((s) => (s.saved.includes(step) ? s : { saved: [...s.saved, step] })),
  setRunning: (running) => set({ running }),
  setFailed: (failed, refused = false) => set({ failed, refused: failed && refused }),
  refreshed: (missionId) => set((s) => (s.missionId === missionId ? { revision: s.revision + 1 } : s)),
  retry: () => set((s) => ({ attempt: s.attempt + 1 })),
}));
