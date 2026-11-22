import type { OwnPhone } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { users } from '../../db/schema';
import { phoneInUse } from '../../errors';

const UNIQUE_VIOLATION = '23505';

function isPhoneConflict(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === UNIQUE_VIOLATION;
}

/** Sets, changes or (with `null`) removes the user's phone number, which Field shows as "call the commander". */
export async function setOwnPhone(
  db: Db,
  { userId, phoneNumber }: { userId: string; phoneNumber: string | null },
): Promise<OwnPhone> {
  try {
    await db.update(users).set({ phoneNumber, updatedAt: new Date() }).where(eq(users.id, userId));
  } catch (error) {
    if (isPhoneConflict(error)) throw phoneInUse();
    throw error;
  }
  return { phoneNumber };
}
