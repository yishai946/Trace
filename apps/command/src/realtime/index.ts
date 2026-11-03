import {
  MissionEvent,
  REALTIME_PATH,
  type ClientToServerEvents,
  type MissionPolygon,
  type Participant,
  type ServerToClientEvents,
} from '@trace/schemas';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { sessionKey } from '../auth';
import { missionKeys } from '../mission/missionQueries';

/** `connecting` until the first join succeeds, `live` while events arrive, `down` while they cannot. */
export type LiveState = 'connecting' | 'live' | 'down';

type MissionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Applies one event to the cached mission data, so the map updates without a refetch. */
function applyEvent(queryClient: QueryClient, event: MissionEvent) {
  switch (event.type) {
    case 'polygon.saved': {
      const { polygon } = event;
      queryClient.setQueryData<MissionPolygon[]>(missionKeys.polygons(event.missionId), (list) =>
        list?.some((p) => p.id === polygon.id)
          ? list.map((p) => (p.id === polygon.id ? polygon : p))
          : list && [...list, polygon],
      );
      return;
    }
    case 'polygon.deleted':
      queryClient.setQueryData<MissionPolygon[]>(missionKeys.polygons(event.missionId), (list) =>
        list?.filter((p) => p.id !== event.polygonId),
      );
      return;
    case 'participant.moved':
      queryClient.setQueryData<Participant[]>(missionKeys.participants(event.missionId), (list) =>
        list?.map((p) =>
          p.id === event.participantId ? { ...p, position: event.position, positionAt: event.positionAt } : p,
        ),
      );
      return;
  }
}

/**
 * Keeps the open mission live over the realtime channel: joins it, applies its events to the cached data, and after a
 * dropped connection joins again and refetches what was missed. Socket.IO reconnects on its own.
 */
export function useMissionLive(missionId: string | undefined): LiveState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ missionId: string | undefined; live: LiveState }>({
    missionId,
    live: 'connecting',
  });

  useEffect(() => {
    if (!missionId) return;
    const set = (live: LiveState) => setState({ missionId, live });
    let joinedBefore = false;
    // Same origin: the session cookie goes with the handshake, and Vite proxies the path in development.
    const socket: MissionSocket = io({ path: REALTIME_PATH, withCredentials: true });

    socket.on('connect', () => {
      socket.emit('mission:join', { missionId }, (result) => {
        if (!result.ok) {
          set('down');
          return;
        }
        // Events sent while the console was away are not replayed: refetch the mission's data after a reconnect.
        if (joinedBefore) void queryClient.invalidateQueries({ queryKey: ['missions', missionId] });
        joinedBefore = true;
        set('live');
      });
    });
    socket.on('mission:event', (raw) => {
      const event = MissionEvent.safeParse(raw);
      if (event.success && event.data.missionId === missionId) applyEvent(queryClient, event.data);
    });
    socket.on('disconnect', (reason) => {
      set('down');
      // The server closed the connection, as when the session expires: it does not reconnect on its own.
      if (reason === 'io server disconnect') void queryClient.invalidateQueries({ queryKey: sessionKey });
    });
    socket.on('connect_error', (error) => {
      set('down');
      if (error.message === 'UNAUTHENTICATED') void queryClient.invalidateQueries({ queryKey: sessionKey });
    });

    return () => {
      socket.disconnect();
    };
  }, [missionId, queryClient]);

  // A different mission starts again from connecting, without waiting for the effect.
  return state.missionId === missionId ? state.live : 'connecting';
}
