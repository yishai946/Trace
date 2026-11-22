import {
  MissionEvent,
  REALTIME_PATH,
  type ClientToServerEvents,
  type Mission,
  type OwnMessage,
  type ServerToClientEvents,
} from '@trace/schemas';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { applySharedEvent, updateOpened, type MissionCacheShape } from '@trace/mission-cache';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiBaseUrl } from '../api';
import { fetchOwnParticipation, missionKeys } from '../mission/queries';
import { upsertMessage } from '../messages/messageList';
import { useSession } from '../state/session';
import { clearOfflinePackages } from '../offline/store';

type MissionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Wait before trying again after the server refused a connection or a join for a passing reason. */
export const RETRY_MS = 5_000;

/**
 * How many own-participation events arrived. A refetch that started before one of them answers with older data, so it
 * is dropped.
 */
let participationEvents = 0;

/** Field keeps the one mission the searcher is in (`missionKeys.mission`). */
const ownMission: MissionCacheShape = {
  patchMission: (queryClient, missionId, change) =>
    queryClient.setQueryData<Mission>(missionKeys.mission(missionId), (mission) => mission && change(mission)),
  // As before: the whole mission is put even when it is not cached yet.
  replaceMission: (queryClient, missionId, mission) =>
    queryClient.setQueryData<Mission>(missionKeys.mission(missionId), mission),
};

/** Applies a mission event to the cached data, so the screens and the map change at once. */
export function applyEvent(queryClient: QueryClient, event: MissionEvent): void {
  applySharedEvent(queryClient, ownMission, event);
  switch (event.type) {
    case 'participant.updated': {
      // Only the searcher's own participation reaches Field (decision 32).
      const { id, callsign, status, polygonId, taskStatus } = event.participant;
      const before = useSession.getState().participation;
      participationEvents += 1;
      // The new polygon's reports were never pushed to this searcher: read them (UC-F11, decision 80).
      if (before?.status !== status || before.polygonId !== polygonId) {
        void queryClient.invalidateQueries({ queryKey: missionKeys.reports(event.missionId) });
      }
      useSession.getState().updateParticipation({ id, callsign, status, polygonId, taskStatus });
      return;
    }
    case 'message.received':
      // A message sent to this searcher; one sent while offline is read after the next join (decision 77).
      updateOpened<OwnMessage>(
        queryClient,
        missionKeys.messages(event.missionId),
        (list) => list && upsertMessage(list, event.message),
      );
      return;
    case 'polygon.saved':
    case 'polygon.deleted':
      void queryClient.invalidateQueries({ queryKey: missionKeys.polygons(event.missionId) });
      return;
    default:
      // Handled by applySharedEvent, for the commander only, or the searcher's own position, which Field already knows.
      return;
  }
}

/**
 * Keeps the searcher's mission live over the realtime channel (UC-C04, UC-C05): joins it with the session token, and
 * applies the commander's changes to the LKP, the rally point, the details and the polygons, and the reports of the
 * searcher's polygon. After every join,
 * including after a lost connection, it refetches the mission, since events sent while away are not replayed. An
 * expired session signs the searcher out; other refusals are tried again.
 */
export function useMissionLive(): void {
  const queryClient = useQueryClient();
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);

  useEffect(() => {
    if (!token || !missionId || !apiBaseUrl) return;
    const socket: MissionSocket = io(apiBaseUrl, {
      path: REALTIME_PATH,
      auth: { token },
      // React Native has no cookies to share: the token is the session, and WebSocket needs no long-polling fallback.
      transports: ['websocket'],
    });
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const later = (action: () => void) => {
      clearTimeout(retry);
      retry = setTimeout(action, RETRY_MS);
    };
    const join = () =>
      socket.emit('mission:join', { missionId }, (result) => {
        if (result.ok) {
          void queryClient.invalidateQueries({ queryKey: missionKeys.mission(missionId) });
          // An SOS sent or closed while away is not replayed either.
          void queryClient.invalidateQueries({ queryKey: missionKeys.sos(missionId) });
          // A message sent while away is not replayed either (decision 77).
          void queryClient.invalidateQueries({ queryKey: missionKeys.messages(missionId) });
          // An assignment made while away is not replayed either. The answer is dropped if the screen closed, the
          // mission changed or a live event came first (it is newer). A failure waits for the next reconnect.
          const seen = participationEvents;
          fetchOwnParticipation(missionId, token).then(
            (own) => {
              const current = !closed && seen === participationEvents && useSession.getState().missionId === missionId;
              if (current) useSession.getState().updateParticipation(own);
            },
            () => undefined,
          );
        } else if (result.code === 'NOT_FOUND') {
          // The searcher is no longer in this mission: the map then offers to join one.
          useSession.getState().setMissionId(null);
          // The missing person's details do not stay on the phone of a searcher who left the mission.
          void clearOfflinePackages().catch(() => undefined);
        } else {
          later(join);
        }
      });
    socket.on('connect', join);
    // A refusal from the server is not retried by Socket.IO itself.
    socket.on('connect_error', (error) => {
      if (error.message === 'UNAUTHENTICATED') void useSession.getState().signOut();
      else later(() => socket.connect());
    });
    socket.on('mission:event', (raw) => {
      const event = MissionEvent.safeParse(raw);
      if (event.success && event.data.missionId === missionId) applyEvent(queryClient, event.data);
    });
    // The server closed the connection (a restart): Socket.IO does not reconnect on its own.
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') socket.connect();
    });
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.disconnect();
    };
  }, [token, missionId, queryClient]);
}
