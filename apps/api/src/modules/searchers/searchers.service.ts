import type { SearcherProfile } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { searchers, users } from '../../db/schema';

/** The searcher's profile, or null while they have not entered a name. */
export async function getOwnProfile(db: Db, userId: string): Promise<SearcherProfile | null> {
  const [profile] = await db
    .select({ id: searchers.id, phone: searchers.phone, name: searchers.name })
    .from(searchers)
    .where(eq(searchers.userId, userId));
  return profile ?? null;
}

/** Creates the profile on the first call and changes the name on later ones. Also sets the sign-in user's name. */
export async function saveOwnProfile(
  db: Db,
  { userId, name }: { userId: string; name: string },
): Promise<SearcherProfile> {
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ phone: users.phoneNumber }).from(users).where(eq(users.id, userId));
    if (!user?.phone) throw new Error('Searcher has no phone number');
    const [profile] = await tx
      .insert(searchers)
      .values({ userId, phone: user.phone, name })
      .onConflictDoUpdate({ target: searchers.userId, set: { name } })
      .returning({ id: searchers.id, phone: searchers.phone, name: searchers.name });
    if (!profile) throw new Error('Searcher upsert returned no row');
    await tx.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
    return profile;
  });
}
