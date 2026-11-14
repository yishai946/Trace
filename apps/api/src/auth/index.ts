import { USER_ROLES, type UserRole } from '@trace/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { bearer, phoneNumber } from 'better-auth/plugins';
import { OTP_LENGTH } from '@trace/schemas';
import { asc, eq, lte, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { accounts, otpRequests, sessions, users, verifications } from '../db/schema';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../env';

/** Delivers a sign-in code to a searcher's phone. */
export type OtpSender = (message: { phoneNumber: string; code: string }) => Promise<void>;

interface AuthOptions {
  env: Env;
  db: Db;
  sendOtp: OtpSender;
  /** Better Auth logs here instead of to the console. */
  log?: FastifyBaseLogger;
}

/** E.164: a plus sign, a country code and up to 15 digits. */
const PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

/**
 * How many sign-in codes one phone number may request per window. The spec sets no value (issue #72 open question);
 * these are the numbers Better Auth's phone-number plugin applies per IP address.
 */
export const OTP_REQUEST_LIMIT = { windowSeconds: 60, max: 10 } as const;

/** Searchers sign in by phone only; Better Auth still needs a unique email, so each gets one that cannot receive mail. */
const placeholderEmail = (phone: string) => `${phone.slice(1)}@phone.trace.invalid`;

/** Records a code request for `phone`, or throws 429 when the number used up its window (OTP_REQUEST_LIMIT). */
async function claimOtpRequest(db: Db, phone: string) {
  const now = new Date();
  const windowMs = OTP_REQUEST_LIMIT.windowSeconds * 1000;
  await db.transaction(async (tx) => {
    // Serialises concurrent requests for one number so none slips past the count.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${phone}))`);
    // Expired rows of every number go, so numbers that never ask again leave nothing behind.
    await tx.delete(otpRequests).where(lte(otpRequests.requestedAt, new Date(now.getTime() - windowMs)));
    const recent = await tx
      .select({ requestedAt: otpRequests.requestedAt })
      .from(otpRequests)
      .where(eq(otpRequests.phone, phone))
      .orderBy(asc(otpRequests.requestedAt));
    const oldest = recent[0];
    if (oldest && recent.length >= OTP_REQUEST_LIMIT.max) {
      const retryAfter = Math.max(1, Math.ceil((oldest.requestedAt.getTime() + windowMs - now.getTime()) / 1000));
      throw new APIError(
        'TOO_MANY_REQUESTS',
        {
          code: 'TOO_MANY_OTP_REQUESTS',
          message: 'Too many sign-in codes were requested for this phone number. Try again later.',
        },
        { 'Retry-After': String(retryAfter) },
      );
    }
    await tx.insert(otpRequests).values({ phone, requestedAt: now });
  });
}

/**
 * Sign-in for both apps (TECH_STACK.md): commanders with email and password, searchers with a phone OTP. Command uses
 * the session cookie; Field can send the session token as `Authorization: Bearer <token>` instead. A searcher gets a
 * profile when they enter their name (`PUT /api/searchers/me`), and each phone number can request only so many codes.
 */
export function createAuth({ env, db, sendOtp, log }: AuthOptions) {
  return betterAuth({
    logger: log
      ? {
          level: 'warn',
          log: (level, message, ...args) =>
            args.length > 0 ? log[level]({ details: args }, `Auth: ${message}`) : log[level](`Auth: ${message}`),
        }
      : undefined,
    baseURL: env.API_URL,
    basePath: '/api/auth',
    secret: env.AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    advanced: { database: { generateId: 'uuid' } },
    telemetry: { enabled: false },
    user: {
      additionalFields: {
        // Set only on the server: by the create-commander script, or `searcher` for anyone who signs up by phone.
        role: { type: [...USER_ROLES], required: true, defaultValue: 'searcher', input: false },
      },
    },
    // Commander accounts are created by an operator (UC-C01 precondition), never by signing up.
    emailAndPassword: { enabled: true, disableSignUp: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/phone-number/send-otp') return;
        const phone: unknown = ctx.body?.phoneNumber;
        // Malformed numbers are rejected by the plugin and not counted.
        if (typeof phone !== 'string' || !PHONE_NUMBER.test(phone)) return;
        await claimOtpRequest(db, phone);
      }),
    },
    plugins: [
      phoneNumber({
        otpLength: OTP_LENGTH,
        sendOTP: (message) => sendOtp(message),
        phoneNumberValidator: (phone) => PHONE_NUMBER.test(phone),
        signUpOnVerification: { getTempEmail: placeholderEmail },
      }),
      bearer(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

interface CommanderInput {
  email: string;
  password: string;
  name: string;
}

/** Creates a commander who can sign in to Command with email and password. Returns the user id. */
export async function createCommander(auth: Auth, { email, password, name }: CommanderInput): Promise<string> {
  const ctx = await auth.$context;
  const role: UserRole = 'commander';
  const user = await ctx.internalAdapter.createUser(
    { email: email.toLowerCase(), name, emailVerified: true, role },
    { method: 'admin' },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await ctx.password.hash(password),
  });
  return user.id;
}
