import type { OwnParticipation } from '@trace/schemas';
import { create } from 'zustand';
import { clearOutbox } from '../../outbox';
import { deleteToken, loadToken, saveToken } from './tokenStore';

interface SessionState {
  /** Better Auth session token from the phone sign-in (UC-F01), sent as `Authorization: Bearer`. */
  token: string | null;
  /** The mission the searcher joined (UC-F02); the mission screens show it. */
  missionId: string | null;
  /** The searcher's participation in that mission, as the server last answered it. */
  participation: OwnParticipation | null;
  /**
   * Background GPS runs (UC-S01): on from the first Start Search, and on until the activity ends or the searcher leaves
   * the mission, also across a move to another polygon (decisions 20, 43, 65).
   */
  tracking: boolean;
  /** Whether the phone has GPS while tracking (decision 42); null before it was checked. */
  gpsAvailable: boolean | null;
  setGpsAvailable: (available: boolean | null) => void;
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
  /** Forgets the token, the mission and the unsent track points, on the device too. */
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
  kind: 'assigned' | 'moved' | 'ended';
  polygonId: string | null;
}

/** A search that started (searching, paused or finished) is tracked until the activity ends (decision 20). */
function isTracking(participation: OwnParticipation): boolean {
  return participation.status !== 'ended' && participation.taskStatus !== null && participation.taskStatus !== 'ready';
}

/**
 * Who the searcher is and which mission they are in. Signing in saves the token on the device (UC-F01), so
 * reopening the app does not ask to sign in again.
 */
export const useSession = create<SessionState>()((set) => ({
  token: null,
  missionId: null,
  participation: null,
  tracking: false,
  gpsAvailable: null,
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
    // Points kept for a later send belong to this searcher; they must not go out under the next sign-in.
    await clearOutbox().catch(() => undefined);
    set({ token: null, missionId: null, participation: null, tracking: false, assignmentNotice: null });
  },
  setMissionId: (missionId) => set({ missionId, participation: null, tracking: false, assignmentNotice: null }),
  enterMission: (missionId, participation) =>
    set({
      missionId,
      participation,
      tracking: isTracking(participation),
      assignmentNotice: null,
      pendingJoinCode: null,
    }),
  setPendingJoinCode: (pendingJoinCode) => set({ pendingJoinCode }),
  updateParticipation: (participation) =>
    set((s) => {
      const before = s.participation;
      const changed = participation.status === 'assigned' && participation.polygonId !== before?.polygonId;
      const ended = participation.status === 'ended' && before !== null && before.status !== 'ended';
      const notice: AssignmentNotice | null = ended
        ? { kind: 'ended', polygonId: null }
        : changed && participation.polygonId
          ? { kind: before?.status === 'assigned' ? 'moved' : 'assigned', polygonId: participation.polygonId }
          : s.assignmentNotice;
      const tracking = isTracking(participation) || (s.tracking && participation.status !== 'ended');
      return { participation, tracking, assignmentNotice: notice };
    }),
  dismissAssignmentNotice: () => set({ assignmentNotice: null }),
  setGpsAvailable: (gpsAvailable) => set({ gpsAvailable }),
}));
