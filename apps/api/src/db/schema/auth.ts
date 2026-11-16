import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { userRole } from './enums';

/*
 * Sign-in tables owned by Better Auth (users, sessions, accounts, verifications). Their columns follow its core schema
 * and the phone-number plugin; `role` is ours. See src/auth.
 */

/** Anyone who signs in: a commander (email and password) or a searcher (phone and OTP). */
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: userRole().notNull().default('searcher'),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: boolean(),
  ...timestamps,
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    ...timestamps,
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** A way to sign in. Commanders have a `credential` account holding the password hash. */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

/** Short-lived codes, such as the OTP sent to a searcher's phone. */
export const verifications = pgTable(
  'verifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

/** Sign-in codes requested per phone number, to limit how often one number gets a code (UC-F01). */
export const otpRequests = pgTable(
  'otp_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    phone: text().notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('otp_requests_phone_requested_at_idx').on(t.phone, t.requestedAt)],
);
