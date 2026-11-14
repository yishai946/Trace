import { MissionEvent, REALTIME_PATH, type ClientToServerEvents, type ServerToClientEvents } from '@trace/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { sessionKey } from '../auth';
import { missionKeys } from '../mission/missionQueries';
import { applyEvent } from './applyEvent';

/** `connecting` until the first join succeeds, `live` while events arrive, `down` while they cannot. */
export type LiveState = 'connecting' | 'live' | 'down';

type MissionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
        // The missions list holds the current LKP, which may have changed while away.
        void queryClient.invalidateQueries({ queryKey: missionKeys.all, exact: true });
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
