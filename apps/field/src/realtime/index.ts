import {
  MissionEvent,
  REALTIME_PATH,
  type ClientToServerEvents,
  type Mission,
  type ServerToClientEvents,
} from '@trace/schemas';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiBaseUrl } from '../api';
import { missionKeys } from '../mission/queries';
import { useSession } from '../state/session';

type MissionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
 * including after a lost connection, it refetches the mission, since events sent while away are not replayed.
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
    socket.on('connect', () => {
      socket.emit('mission:join', { missionId }, (result) => {
        if (result.ok) void queryClient.invalidateQueries({ queryKey: missionKeys.mission(missionId) });
      });
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
      socket.disconnect();
    };
  }, [token, missionId, queryClient]);
}
