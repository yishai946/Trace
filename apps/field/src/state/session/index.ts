import type { OwnParticipation } from '@trace/schemas';
import { create } from 'zustand';
import { deleteToken, loadToken, saveToken } from './tokenStore';

interface SessionState {
  /** Better Auth session token from the phone sign-in (UC-F01), sent as `Authorization: Bearer`. */
  token: string | null;
  /** The mission the searcher joined (UC-F02); the mission screens show it. */
  missionId: string | null;
  /** The searcher's participation in that mission, as the server last answered it. */
  participation: OwnParticipation | null;
  /** Set when the commander assigned or moved the searcher while the app was open (UC-F05); cleared once seen. */
  assignmentNotice: AssignmentNotice | null;
  /** The code of a join link opened before the join screen could show it, e.g. while signed out (UC-F02). */
  pendingJoinCode: string | null;
  /** True once the token saved on the device was read at launch; the start screen waits for it. */
  restored: boolean;
  /** Reads the token saved on the device. A token set meanwhile by signing in wins. */
  restore: () => Promise<void>;
  /** Keeps the token in memory and saves it on the device. */
  signIn: (token: string) => Promise<void>;
  /** Forgets the token and the mission, on the device too. */
  signOut: () => Promise<void>;
  setMissionId: (missionId: string | null) => void;
  /** Enters the mission the searcher joined. */
  enterMission: (missionId: string, participation: OwnParticipation) => void;
  setPendingJoinCode: (code: string | null) => void;
  /** The participation as the server sent it now; notes an assignment or a move. */
  updateParticipation: (participation: OwnParticipation) => void;
  dismissAssignmentNotice: () => void;
}

export interface AssignmentNotice {
  kind: 'assigned' | 'moved';
  polygonId: string;
}

/**
 * Who the searcher is and which mission they are in. Signing in saves the token on the device (UC-F01), so
 * reopening the app does not ask to sign in again.
 */
export const useSession = create<SessionState>()((set) => ({
  token: null,
  missionId: null,
  participation: null,
  assignmentNotice: null,
  pendingJoinCode: null,
  restored: false,
  restore: async () => {
    const stored = await loadToken();
    set((s) => ({ token: s.token ?? stored, restored: true }));
  },
  signIn: async (token) => {
    await saveToken(token);
    set({ token, restored: true });
  },
  signOut: async () => {
    await deleteToken();
    set({ token: null, missionId: null, participation: null, assignmentNotice: null });
  },
  setMissionId: (missionId) => set({ missionId, participation: null, assignmentNotice: null }),
  enterMission: (missionId, participation) => set({ missionId, participation, pendingJoinCode: null }),
  setPendingJoinCode: (pendingJoinCode) => set({ pendingJoinCode }),
  updateParticipation: (participation) =>
    set((s) => {
      const before = s.participation;
      const changed = participation.status === 'assigned' && participation.polygonId !== before?.polygonId;
      const notice: AssignmentNotice | null =
        changed && participation.polygonId
          ? { kind: before?.status === 'assigned' ? 'moved' : 'assigned', polygonId: participation.polygonId }
          : s.assignmentNotice;
      return { participation, assignmentNotice: notice };
    }),
  dismissAssignmentNotice: () => set({ assignmentNotice: null }),
}));
