import { USER_ROLES } from '@trace/domain';
import { z } from 'zod';

/** The signed-in user, as /api/auth/get-session returns it. Better Auth sends more fields; only these are read. */
export const SessionUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(USER_ROLES),
});

/** /api/auth/get-session: the current session, or null when nobody is signed in. */
export const AuthSession = z.object({ user: SessionUser }).nullable();

export const SignInBody = z.object({ email: z.email(), password: z.string().min(1) });

export type SessionUser = z.infer<typeof SessionUser>;
export type AuthSession = z.infer<typeof AuthSession>;
export type SignInBody = z.infer<typeof SignInBody>;

/** Digits in a phone sign-in code (UC-F01). Wireframe Fm01 and Better Auth's default; the API passes it to the plugin. */
export const OTP_LENGTH = 6;

/** POST /api/auth/phone-number/verify: the session token Field sends as `Authorization: Bearer`. Better Auth sends more fields. */
export const PhoneSignIn = z.object({ token: z.string().min(1), user: z.object({ id: z.string() }) });
export type PhoneSignIn = z.infer<typeof PhoneSignIn>;
