import { create } from 'zustand';

interface SessionState {
  /** Better Auth session token from the phone sign-in (UC-F01), sent as `Authorization: Bearer`. */
  token: string | null;
  /** The mission the searcher joined (UC-F02); the mission screens show it. */
  missionId: string | null;
  setToken: (token: string | null) => void;
  setMissionId: (missionId: string | null) => void;
  clear: () => void;
}

/** Who the searcher is and which mission they are in. Sign-in and joining fill it; until then it stays empty. */
export const useSession = create<SessionState>()((set) => ({
  token: null,
  missionId: null,
  setToken: (token) => set({ token }),
  setMissionId: (missionId) => set({ missionId }),
  clear: () => set({ token: null, missionId: null }),
}));
