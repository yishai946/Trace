import { SearcherProfile } from '@trace/schemas';
import { sql } from 'drizzle-orm';
import type { InjectOptions } from 'fastify';
import { buildApp } from '../app';
import { createCommander } from '../auth';
import { createDb, type Db } from '../db';
import { loadEnv } from '../env';
import { participations, searchers, users } from '../db/schema';
import { TEST_DATABASE_URL } from './testing.config';

/** Builds the app on the test database. Call `close` in `afterAll`. */
export async function createTestApp() {
  const database = createDb(TEST_DATABASE_URL);
  /** The last sign-in code sent to each phone number. */
  const sentCodes = new Map<string, string>();
  /** Every sign-in code sent, in order. */
  const sentOtps: { phoneNumber: string; code: string }[] = [];
  const { app, auth, realtime } = await buildApp({
    env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: TEST_DATABASE_URL }),
    db: database.db,
    realtimeRevalidateMs: 100,
    sendOtp: async ({ phoneNumber, code }) => {
      sentCodes.set(phoneNumber, code);
      sentOtps.push({ phoneNumber, code });
    },
  });
  return {
    app,
    auth,
    realtime,
    db: database.db,
    sentCodes,
    sentOtps,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestApp>>;

/** Empties every table between tests. */
export async function resetDb(db: Db) {
  await db.execute(
    sql`truncate missions, lkp_points, polygons, searchers, participations, users, sessions, accounts, verifications, otp_requests restart identity cascade`,
  );
}

/** A signed-in user and the headers that authenticate their requests. */
export interface TestUser {
  userId: string;
  headers: Record<string, string>;
}

let counter = 0;
const next = () => (counter += 1);

/** `name=value` pairs from a response's Set-Cookie headers, ready for a Cookie header. */
function cookiesFrom(setCookie: string | string[] | undefined): string {
  const all = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return all.map((cookie) => cookie.split(';')[0]).join('; ');
}

/** Creates a commander and signs in with email and password, as Command does. Requests carry the session cookie. */
export async function signInCommander(ctx: TestContext): Promise<TestUser> {
  const email = `commander${next()}@trace.test`;
  const password = 'correct-horse-battery';
  const userId = await createCommander(ctx.auth, { email, password, name: 'מנהל' });
  const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-in/email', payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`Commander sign-in failed: ${res.statusCode} ${res.body}`);
  return { userId, headers: { cookie: cookiesFrom(res.headers['set-cookie']) } };
}

/** Asks for a sign-in code, as Field does. */
export const requestOtp = (ctx: TestContext, phoneNumber: string) =>
  ctx.app.inject({ method: 'POST', url: '/api/auth/phone-number/send-otp', payload: { phoneNumber } });

/** Sends the code the searcher received. */
export const verifyOtp = (ctx: TestContext, phoneNumber: string, code: string) =>
  ctx.app.inject({ method: 'POST', url: '/api/auth/phone-number/verify', payload: { phoneNumber, code } });

const nextPhoneNumber = () => `+97252${String(next()).padStart(7, '0')}`;

/**
 * Signs in by phone OTP, as Field does. Requests carry the session token as a bearer token. The searcher has no
 * profile until they enter a name (`signInSearcher` does that too).
 */
export async function signInByPhone(
  ctx: TestContext,
  phoneNumber: string = nextPhoneNumber(),
): Promise<TestUser & { token: string; phoneNumber: string }> {
  const sent = await requestOtp(ctx, phoneNumber);
  if (sent.statusCode !== 200) throw new Error(`Requesting a sign-in code failed: ${sent.statusCode} ${sent.body}`);
  const code = ctx.sentCodes.get(phoneNumber);
  if (!code) throw new Error('No sign-in code was sent');
  const res = await verifyOtp(ctx, phoneNumber, code);
  const body = res.json<{ token?: string; user?: { id: string } }>();
  if (res.statusCode !== 200 || !body.token || !body.user) throw new Error(`Searcher sign-in failed: ${res.body}`);
  return { userId: body.user.id, token: body.token, phoneNumber, headers: { authorization: `Bearer ${body.token}` } };
}

/** Signs a searcher in by phone and enters their name, as Field does on first sign-in. */
export async function signInSearcher(
  ctx: TestContext,
  options: { phoneNumber?: string; name?: string } = {},
): Promise<TestUser & { searcherId: string }> {
  const user = await signInByPhone(ctx, options.phoneNumber);
  const res = await ctx.app.inject({
    method: 'PUT',
    url: '/api/searchers/me',
    headers: user.headers,
    payload: { name: options.name ?? `מחפש ${next()}` },
  });
  if (res.statusCode !== 200) throw new Error(`Entering the searcher name failed: ${res.statusCode} ${res.body}`);
  return { userId: user.userId, headers: user.headers, searcherId: SearcherProfile.parse(res.json()).id };
}

/** `app.inject` on behalf of a signed-in user. */
export const injectAs = (ctx: TestContext, user: TestUser) => (options: InjectOptions) =>
  ctx.app.inject({ ...options, headers: { ...user.headers, ...options.headers } });

/** A searcher who never signs in during the test: a user row and a profile. */
async function createSearcher(db: Db, name: string) {
  const n = next();
  const phone = `+97253${String(n).padStart(7, '0')}`;
  const [user] = await db
    .insert(users)
    .values({ name, email: `searcher${n}@trace.test`, phoneNumber: phone, phoneNumberVerified: true })
    .returning({ id: users.id });
  if (!user) throw new Error('User insert returned no row');
  const [searcher] = await db
    .insert(searchers)
    .values({ userId: user.id, phone, name })
    .returning({ id: searchers.id });
  if (!searcher) throw new Error('Searcher insert returned no row');
  return searcher.id;
}

/** Adds a searcher to a mission, optionally assigned to a polygon at a position. Returns the participation id. */
export async function addParticipant(
  db: Db,
  options: {
    missionId: string;
    callsign: number;
    /** An existing searcher, such as one from `signInSearcher`. A new one is created otherwise. */
    searcherId?: string;
    polygonId?: string;
    position?: [number, number];
  },
) {
  const searcherId = options.searcherId ?? (await createSearcher(db, `מחפש ${options.callsign}`));
  const [participation] = await db
    .insert(participations)
    .values({
      missionId: options.missionId,
      searcherId,
      callsign: options.callsign,
      status: options.polygonId ? 'assigned' : 'available',
      polygonId: options.polygonId ?? null,
      taskStatus: options.polygonId ? 'searching' : null,
      lastPosition: options.position ? { type: 'Point', coordinates: options.position } : null,
      lastPositionAt: options.position ? new Date() : null,
    })
    .returning({ id: participations.id });
  if (!participation) throw new Error('Participation insert returned no row');
  return participation.id;
}
