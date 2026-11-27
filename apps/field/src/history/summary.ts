import { STOP_REASON_LABELS } from '@trace/domain';
import type { Mission } from '@trace/schemas';

/** `14.09.2026`: the day a mission ended, as the history list shows it (wireframe Fm15). */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** The mission's title in the list: its name, the missing person and their age, e.g. `מסע 0371, מאיר חדד, 68`. */
export function missionTitle(mission: Mission): string {
  const { name, age } = mission.missingPerson;
  return [mission.name, name, age === null ? null : String(age)].filter((part) => part !== null).join(', ');
}

/** How the mission ended and when: the located or the stopped record the server keeps. */
export function endedOutcome(mission: Mission): { word: string; result: string; endedAt: string | null } {
  if (mission.located) return { word: 'אותר', result: 'הנעדר אותר', endedAt: mission.located.endedAt };
  if (mission.stopped) {
    const reason = STOP_REASON_LABELS[mission.stopped.reason];
    return { word: 'הופסק', result: `החיפוש הופסק: ${reason}`, endedAt: mission.stopped.endedAt };
  }
  return { word: 'הסתיים', result: 'המסע הסתיים', endedAt: null };
}
