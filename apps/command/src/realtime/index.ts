import {
  MissionEvent,
  REALTIME_PATH,
  type ClientToServerEvents,
  type Mission,
  type MissionPolygon,
  type Participant,
  type ServerToClientEvents,
  type TimelineEvent,
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
    case 'rally.changed':
      queryClient.setQueryData<Mission[]>(missionKeys.all, (list) =>
        list?.map((m) =>
          m.id === event.missionId ? { ...m, rallyPoint: event.rallyPoint, updatedAt: event.updatedAt } : m,
        ),
      );
      return;
    case 'mission.updated':
      queryClient.setQueryData<Mission[]>(missionKeys.all, (list) =>
        list?.map((m) => (m.id === event.missionId ? event.mission : m)),
      );
      return;
    case 'participant.moved':
      queryClient.setQueryData<Participant[]>(missionKeys.participants(event.missionId), (list) =>
        list?.map((p) =>
          p.id === event.participantId ? { ...p, position: event.position, positionAt: event.positionAt } : p,
        ),
      );
      return;
    case 'timeline.recorded': {
      const key = missionKeys.timeline(event.missionId);
      // Not cached yet: either the Timeline was never opened, or its first fetch is in flight and may have read the
      // server before this event. Cancel that fetch and fetch again (an in-flight first fetch is otherwise reused),
      // so it cannot leave the list without the event. Nothing happens if the Timeline was never opened.
      if (!queryClient.getQueryData(key)) {
        void queryClient.cancelQueries({ queryKey: key }).then(() => queryClient.invalidateQueries({ queryKey: key }));
        return;
      }
      // The sort is stable, so events of the same instant keep their arrival order, as the API orders them by
      // recording order.
      queryClient.setQueryData<TimelineEvent[]>(key, (list) =>
        list && !list.some((e) => e.id === event.event.id)
          ? [...list, event.event].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
          : list,
      );
      return;
    }
  }
}

/**
 * Keeps the open mission live over the realtime channel: joins it, applies its events to the cached data, and after a
 * dropped connection joins again. Every successful join refetches what was missed before it. Socket.IO reconnects on its own.
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
    // Same origin: the session cookie goes with the handshake, and Vite proxies the path in development.
    const socket: MissionSocket = io({ path: REALTIME_PATH, withCredentials: true });

    socket.on('connect', () => {
      socket.emit('mission:join', { missionId }, (result) => {
        if (!result.ok) {
          set('down');
          return;
        }
        // Events sent before the join (while the first fetch ran, or while disconnected) are not replayed: refetch.
        void queryClient.invalidateQueries({ queryKey: ['missions', missionId] });
        set('live');
      });
    });
    socket.on('mission:event', (raw) => {
      const event = MissionEvent.safeParse(raw);
      if (event.success && event.data.missionId === missionId) applyEvent(queryClient, event.data);
    });
    socket.on('disconnect', (reason) => {
      set('down');
      // The server closed the connection (a restart, or an expired session): Socket.IO does not reconnect on its own.
      // Check the session and connect again; an expired one fails with UNAUTHENTICATED and signs the user out.
      if (reason === 'io server disconnect') {
        void queryClient.invalidateQueries({ queryKey: sessionKey });
        socket.connect();
      }
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
