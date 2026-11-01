import { USER_ROLES, type UserRole } from '@trace/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, phoneNumber } from 'better-auth/plugins';
import type { Db } from '../db';
import { accounts, sessions, users, verifications } from '../db/schema';
import type { Env } from '../env';

/** Delivers a sign-in code to a searcher's phone. */
export type OtpSender = (message: { phoneNumber: string; code: string }) => Promise<void>;

interface AuthOptions {
  env: Env;
  db: Db;
  sendOtp: OtpSender;
}

/** E.164: a plus sign, a country code and up to 15 digits. */
const PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

/** Searchers sign in by phone only; Better Auth still needs a unique email, so each gets one that cannot receive mail. */
const placeholderEmail = (phone: string) => `${phone.slice(1)}@phone.trace.invalid`;

/**
 * Sign-in for both apps (TECH_STACK.md): commanders with email and password, searchers with a phone OTP. Command uses
 * the session cookie; Field can send the session token as `Authorization: Bearer <token>` instead.
 */
export function createAuth({ env, db, sendOtp }: AuthOptions) {
  return betterAuth({
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
    plugins: [
      phoneNumber({
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
