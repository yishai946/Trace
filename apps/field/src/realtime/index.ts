import {
  MissionEvent,
  REALTIME_PATH,
  type ClientToServerEvents,
  OwnParticipation,
  type Mission,
  type ServerToClientEvents,
} from '@trace/schemas';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiBaseUrl, apiRequest } from '../api';
import { missionKeys } from '../mission/queries';
import { useSession } from '../state/session';

type MissionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Wait before trying again after the server refused a connection or a join for a passing reason. */
export const RETRY_MS = 5_000;

/**
 * How many own-participation events arrived. A refetch that started before one of them answers with older data, so it
 * is dropped.
 */
let participationEvents = 0;

/** Applies a mission event to the cached data, so the screens and the map change at once. */
export function applyEvent(queryClient: QueryClient, event: MissionEvent): void {
  const key = missionKeys.mission(event.missionId);
  const patch = (change: (mission: Mission) => Mission) =>
    queryClient.setQueryData<Mission>(key, (mission) => mission && change(mission));
  switch (event.type) {
    case 'lkp.changed':
      patch((m) => ({ ...m, lkp: event.lkp }));
      return;
    case 'rally.changed':
      patch((m) => ({ ...m, rallyPoint: event.rallyPoint, updatedAt: event.updatedAt }));
      return;
    case 'mission.updated':
      queryClient.setQueryData<Mission>(key, event.mission);
      return;
    case 'participant.updated': {
      // Only the searcher's own participation reaches Field (decision 32).
      const { id, callsign, status, polygonId, taskStatus } = event.participant;
      participationEvents += 1;
      useSession.getState().updateParticipation({ id, callsign, status, polygonId, taskStatus });
      return;
    }
    case 'polygon.saved':
    case 'polygon.deleted':
      void queryClient.invalidateQueries({ queryKey: missionKeys.polygons(event.missionId) });
      return;
    default:
      // Events for the commander only, or the searcher's own position, which Field already knows.
      return;
  }
}

/**
 * Keeps the searcher's mission live over the realtime channel (UC-C04, UC-C05): joins it with the session token, and
 * applies the commander's changes to the LKP, the rally point, the details and the polygons. After every join,
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
          // An assignment made while away is not replayed either. The answer is dropped if the screen closed, the
          // mission changed or a live event came first (it is newer). A failure waits for the next reconnect.
          const seen = participationEvents;
          apiRequest(`/missions/${missionId}/participation`, {
            baseUrl: apiBaseUrl,
            token,
            schema: OwnParticipation,
          }).then(
            (own) => {
              const current = !closed && seen === participationEvents && useSession.getState().missionId === missionId;
              if (current) useSession.getState().updateParticipation(own);
            },
            () => undefined,
          );
        } else if (result.code === 'NOT_FOUND') {
          // The searcher is no longer in this mission: the map then offers to join one.
          useSession.getState().setMissionId(null);
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
