import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Db } from '../db';
import { searchers } from '../db/schema';
import { forbidden, unauthenticated } from '../errors';
import type { Auth } from '.';

/** The signed-in user a request acts for. */
export type Actor =
  | { role: 'commander'; userId: string }
  /** `searcherId` is null until the searcher has a profile (name entered on first sign-in, UC-F01). */
  | { role: 'searcher'; userId: string; searcherId: string | null };

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null;
    /** The Better Auth session the request signed in with. */
    sessionId: string | null;
  }
}

/** The request's actor. Use inside `authenticated` routes, where it is always set. */
export function actorOf(request: Pick<FastifyRequest, 'actor'>): Actor {
  if (!request.actor) throw unauthenticated();
  return request.actor;
}

/** A signed-in searcher who has a profile (UC-F01): the only searcher who may act in a mission. */
export type SearcherActor = { role: 'searcher'; userId: string; searcherId: string };

/**
 * The request's actor as a searcher with a profile; anyone else gets 403. Use after the `searchersOnly` guard, where
 * it only narrows the type.
 */
export function searcherOf(request: Pick<FastifyRequest, 'actor'>): SearcherActor {
  const actor = actorOf(request);
  if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
  return { role: 'searcher', userId: actor.userId, searcherId: actor.searcherId };
}

/** The id of the session the request signed in with. Use inside `authenticated` routes, where it is always set. */
export function sessionIdOf(request: FastifyRequest): string {
  if (!request.sessionId) throw unauthenticated();
  return request.sessionId;
}

/**
 * The request's headers with `x-forwarded-for` set to the client address Fastify resolved (`request.ip`, which honours
 * `trustProxy`). Better Auth rate-limits by that header, so a value sent by an untrusted client never reaches it.
 */
function withClientIp(request: FastifyRequest): Headers {
  const headers = fromNodeHeaders(request.headers);
  headers.set('x-forwarded-for', request.ip);
  return headers;
}

/** Serves Better Auth's own endpoints (sign-in, OTP, sign-out, session) under /api/auth. */
export const authRoutes: FastifyPluginAsync<{ auth: Auth }> = async (app, { auth }) => {
  app.route({
    method: ['GET', 'POST'],
    url: '/auth/*',
    schema: { hide: true },
    async handler(request, reply) {
      const response = await auth.handler(
        new Request(new URL(request.url, auth.options.baseURL), {
          method: request.method,
          headers: withClientIp(request),
          body: request.method === 'GET' || request.body === undefined ? undefined : JSON.stringify(request.body),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    },
  });
};

/** The actor a set of request headers signs in as, and when their session ends. Null without a valid session. */
export async function resolveSession(
  { auth, db }: { auth: Auth; db: Db },
  headers: Headers,
): Promise<{ actor: Actor; sessionId: string; expiresAt: Date } | null> {
  const result = await auth.api.getSession({ headers });
  if (!result) return null;
  const { id: userId, role } = result.user;
  const { expiresAt, id: sessionId } = result.session;
  if (role === 'commander') return { actor: { role, userId }, sessionId, expiresAt };
  const [profile] = await db.select({ id: searchers.id }).from(searchers).where(eq(searchers.userId, userId));
  return { actor: { role: 'searcher', userId, searcherId: profile?.id ?? null }, sessionId, expiresAt };
}

/**
 * Requires a signed-in user for every route registered on `app` and its children, and sets `request.actor`.
 * Call it on a scope that holds only protected routes; health and /api/auth stay outside it.
 */
export function requireSignIn(app: FastifyInstance, options: { auth: Auth; db: Db }) {
  app.decorateRequest('actor', null);
  app.decorateRequest('sessionId', null);
  app.addHook('onRequest', async (request) => {
    const session = await resolveSession(options, fromNodeHeaders(request.headers));
    if (!session) throw unauthenticated();
    request.actor = session.actor;
    request.sessionId = session.sessionId;
  });
}
