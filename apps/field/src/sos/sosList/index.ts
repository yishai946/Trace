import type { CreateSosBody, Sos } from '@trace/schemas';
import type { CurrentFix } from '../../location/useCurrentFix';
import { formatTime } from '../../mission/missionArea';

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

/** How a closed SOS ended, as a sentence for its sender: by the commander or by themselves, and when. */
export function endedSentence(sos: Sos | null): string | null {
  if (!sos?.closedAt) return null;
  const by = sos.closedBy?.role === 'commander' ? 'על ידי המנהל' : 'על ידך';
  return `ה-SOS שהפעלת נסגר ${by} ב-${formatTime(sos.closedAt)}.`;
}

/** The phone's fix as the SOS location; null when there is none, and the server uses the last known position. */
export function sosLocationOf(fix: CurrentFix | null): CreateSosBody['location'] {
  if (!fix) return null;
  return {
    position: { type: 'Point', coordinates: fix.position },
    recordedAt: new Date(fix.at).toISOString(),
    accuracy: fix.accuracy,
  };
}
