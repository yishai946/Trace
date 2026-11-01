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
