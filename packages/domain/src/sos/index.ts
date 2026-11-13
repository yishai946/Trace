import type { ParticipationStatus } from '../participation';
import type { UserRole } from '../role';

/** An SOS is Active from activation until it is closed (UC-F13). */
export const SOS_STATUSES = ['active', 'closed'] as const;
export type SosStatus = (typeof SOS_STATUSES)[number];

/**
 * A searcher may activate an SOS until their activity ended (UC-F13). Safety continues until Finish Activity, whatever
 * the mission's state (overview §6).
 */
export function canActivateSos(status: ParticipationStatus): boolean {
  return status !== 'ended';
}

/** The searcher who activated an SOS or the mission's commander closes it (decision 99). */
export function canCloseSos({ role, isSender }: { role: UserRole; isSender: boolean }): boolean {
  return role === 'commander' || isSender;
}
