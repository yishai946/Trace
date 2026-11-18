import type { Sos } from '@trace/schemas';

/** Puts an SOS in the list (replacing the one with its id), newest first, as the server lists them. */
export function upsertSos(list: Sos[], sos: Sos): Sos[] {
  return [...list.filter((item) => item.id !== sos.id), sos].sort((a, b) => b.activatedAt.localeCompare(a.activatedAt));
}

function ownNewest(list: Sos[], participantId: string | undefined): Sos | null {
  if (!participantId) return null;
  return list.find((sos) => sos.sender.participantId === participantId) ?? null;
}

/** The searcher's own SOS that is still active. The list also holds SOS sent to them, which are not theirs to close. */
export function ownActiveSos(list: Sos[], participantId: string | undefined): Sos | null {
  const newest = ownNewest(list, participantId);
  return newest?.status === 'active' ? newest : null;
}

/** The searcher's newest own SOS when it is closed: the screen tells them how it ended. */
export function ownClosedSos(list: Sos[], participantId: string | undefined): Sos | null {
  const newest = ownNewest(list, participantId);
  return newest?.status === 'closed' ? newest : null;
}
