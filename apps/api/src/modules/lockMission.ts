import type { MissionStatus } from '@trace/domain';
import { eq } from 'drizzle-orm';
import type { Tx } from '../db';
import { missions } from '../db/schema';
import { notFound, type AppError } from '../errors';

/**
 * Locks the mission row, so a change does not race the mission ending or another change of the same kind, and refuses
 * the change when the mission's status does not allow it.
 */
export async function lockMission(
  tx: Tx,
  missionId: string,
  { allowed, refusal }: { allowed: (status: MissionStatus) => boolean; refusal: () => AppError },
): Promise<void> {
  const [mission] = await tx
    .select({ status: missions.status })
    .from(missions)
    .where(eq(missions.id, missionId))
    .for('update');
  if (!mission) throw notFound('Mission');
  if (!allowed(mission.status)) throw refusal();
}
