import type { ParticipationStatus } from '../participation';

/** Who saw the missing person (decision 61): the reporter themself or an eyewitness. No certainty level or photo. */
export const SIGHTING_SOURCES = ['self', 'witness'] as const;
export type SightingSource = (typeof SIGHTING_SOURCES)[number];

/** The commander's answer when TRACE suggests making a sighting the new LKP (decisions 59, 63). */
export const LKP_DECISIONS = ['accepted', 'rejected'] as const;
export type LkpDecision = (typeof LKP_DECISIONS)[number];

/**
 * Whether TRACE suggests the sighting as the new LKP: still undecided and seen strictly later than the current LKP
 * (UC-C04 step 3). With no LKP yet, any undecided sighting is suggested. Times are compared as instants, so the
 * offsets they were sent with do not matter.
 */
export function isLkpCandidate(
  sighting: { observedAt: Date; lkpDecision: LkpDecision | null },
  currentLkpObservedAt: Date | null,
): boolean {
  if (sighting.lkpDecision !== null) return false;
  if (currentLkpObservedAt === null) return true;
  return sighting.observedAt.getTime() > currentLkpObservedAt.getTime();
}

/** Whether a searcher may report a sighting: while the participation is open, available or assigned (UC-F10). */
export function canReportSighting(status: ParticipationStatus): boolean {
  return status !== 'ended';
}
