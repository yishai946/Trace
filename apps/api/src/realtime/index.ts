import {
  JoinMissionRequest,
  REALTIME_PATH,
  type ClientToServerEvents,
  type ErrorCode,
  type MissionEvent,
  type ServerToClientEvents,
} from '@trace/schemas';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import type { Auth } from '../auth';
import { checkMissionAccess } from '../auth/auth.access';
import { resolveSession, type Actor } from '../auth/auth.plugin';
import type { Db } from '../db';
import type { Env } from '../env';
import { AppError } from '../errors';

/** Sends live updates to the users connected to a mission. */
export interface Realtime {
  publish(event: MissionEvent): void;
}

interface SocketData {
  actor: Actor;
}

type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Rooms per mission: everyone who joined it, its commander, and each searcher on their own.
const membersRoom = (missionId: string) => `mission:${missionId}`;
const commanderRoom = (missionId: string) => `mission:${missionId}:commander`;
const searcherRoom = (missionId: string, searcherId: string) => `mission:${missionId}:searcher:${searcherId}`;

function roomsFor(actor: Actor, missionId: string): string[] {
  if (actor.role === 'commander') return [membersRoom(missionId), commanderRoom(missionId)];
  return actor.searcherId ? [membersRoom(missionId), searcherRoom(missionId, actor.searcherId)] : [];
}

/** Who gets an event. Positions go only to the commander and the searcher who moved (decision 32). */
function audienceOf(event: MissionEvent): string[] {
  if (event.type === 'participant.moved') {
    return [commanderRoom(event.missionId), searcherRoom(event.missionId, event.searcherId)];
  }
  return [membersRoom(event.missionId)];
}

/** setTimeout cannot wait longer than about 24.8 days. */
const MAX_TIMER_MS = 2 ** 31 - 1;

const UNAUTHENTICATED: ErrorCode = 'UNAUTHENTICATED';

/**
 * Serves the realtime channel on the app's HTTP server (TECH_STACK.md: Socket.IO, a room per mission). A connection
 * needs the same session as REST: Command's cookie, or Field's token in `auth: { token }`. It is closed when the
 * session expires. A client joins a mission only if it may read it, with the same rules as the REST routes.
 */
export function createRealtime({ app, auth, db, env }: { app: FastifyInstance; auth: Auth; db: Db; env: Env }) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(app.server, {
    path: REALTIME_PATH,
    serveClient: false,
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const headers = fromNodeHeaders(socket.request.headers);
      const token: unknown = socket.handshake.auth.token;
      if (typeof token === 'string') headers.set('authorization', `Bearer ${token}`);
      const session = await resolveSession({ auth, db }, headers);
      if (!session) return next(new Error(UNAUTHENTICATED));
      socket.data.actor = session.actor;
      const timer = setTimeout(
        () => socket.disconnect(true),
        Math.min(Math.max(session.expiresAt.getTime() - Date.now(), 0), MAX_TIMER_MS),
      );
      socket.on('disconnect', () => clearTimeout(timer));
      next();
    } catch (error) {
      app.log.error(error, 'Realtime sign-in failed');
      next(new Error('INTERNAL_ERROR'));
    }
  });

  io.on('connection', (socket: RealtimeSocket) => {
    const { actor } = socket.data;

    socket.on('mission:join', async (raw, ack) => {
      if (typeof ack !== 'function') return;
      const request = JoinMissionRequest.safeParse(raw);
      if (!request.success) return ack({ ok: false, code: 'VALIDATION_ERROR' });
      const { missionId } = request.data;
      try {
        await checkMissionAccess(db, actor, missionId, 'member');
      } catch (error) {
        if (error instanceof AppError) return ack({ ok: false, code: error.code });
        app.log.error(error, 'Realtime join failed');
        return ack({ ok: false, code: 'INTERNAL_ERROR' });
      }
      const rooms = roomsFor(actor, missionId);
      // A searcher without a profile cannot be a member, so the access check already turned them away.
      if (rooms.length === 0) return ack({ ok: false, code: 'NOT_FOUND' });
      await socket.join(rooms);
      ack({ ok: true });
    });

    socket.on('mission:leave', async (raw) => {
      const request = JoinMissionRequest.safeParse(raw);
      if (!request.success) return;
      await Promise.all(roomsFor(actor, request.data.missionId).map((room) => socket.leave(room)));
    });
  });

  // Close open sockets first: they would otherwise keep the HTTP server from closing.
  app.addHook('preClose', async () => {
    io.disconnectSockets(true);
    io.engine.close();
  });

  const realtime: Realtime = {
    publish(event) {
      io.to(audienceOf(event)).emit('mission:event', event);
    },
  };
  return realtime;
}
