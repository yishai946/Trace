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
// shortcut: rooms live in this process only; with more than one API instance, add the Socket.IO Postgres adapter.
const membersRoom = (missionId: string) => `mission:${missionId}`;
const commanderRoom = (missionId: string) => `mission:${missionId}:commander`;
const searcherRoom = (missionId: string, searcherId: string) => `mission:${missionId}:searcher:${searcherId}`;

function roomsFor(actor: Actor, missionId: string): string[] {
  if (actor.role === 'commander') return [membersRoom(missionId), commanderRoom(missionId)];
  return actor.searcherId ? [membersRoom(missionId), searcherRoom(missionId, actor.searcherId)] : [];
}

/**
 * Who gets an event. Positions go only to the commander and the searcher who moved (decision 32). Sightings go only to
 * the commander: searchers see the LKP, not sightings (decisions 31, 32). An LKP change reaches every member.
 */
function audienceOf(event: MissionEvent): string[] {
  if (event.type === 'sighting.saved') return [commanderRoom(event.missionId)];
  // The Timeline is the commander's (UC-C19); searchers do not get it.
  if (event.type === 'timeline.recorded') return [commanderRoom(event.missionId)];
  if (event.type === 'participant.moved') {
    return [commanderRoom(event.missionId), searcherRoom(event.missionId, event.searcherId)];
  }
  return [membersRoom(event.missionId)];
}

/** How often an open connection checks that its session is still valid. */
const REVALIDATE_MS = 30_000;

const UNAUTHENTICATED: ErrorCode = 'UNAUTHENTICATED';

/**
 * Serves the realtime channel on the app's HTTP server (TECH_STACK.md: Socket.IO, a room per mission). A connection
 * needs the same session as REST: Command's cookie, or Field's token in `auth: { token }`. The session is checked
 * again every `revalidateMs`, and the connection is closed once it expired or was revoked (signed out elsewhere).
 * A client joins a mission only if it may read it, with the same rules as the REST routes.
 */
export function createRealtime({
  app,
  auth,
  db,
  env,
  revalidateMs = REVALIDATE_MS,
}: {
  app: FastifyInstance;
  auth: Auth;
  db: Db;
  env: Env;
  revalidateMs?: number;
}) {
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
      const timer = setInterval(() => {
        resolveSession({ auth, db }, headers)
          .then((current) => {
            if (!current || current.expiresAt.getTime() <= Date.now()) socket.disconnect(true);
          })
          .catch((error: unknown) => app.log.error(error, 'Realtime session check failed'));
      }, revalidateMs);
      socket.on('disconnect', () => clearInterval(timer));
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
