import type { BadgeTone } from '../Badge';

export interface TaskState {
  title: string;
  badge: string;
  tone: BadgeTone;
}

/** The heading and badge of the assigned task by its status: Ready, Searching, Paused or Finished (Fm05, Fm06, Fm07). */
export function taskState(taskStatus: string | null, polygonName: string | undefined): TaskState {
  const suffix = polygonName ? `, ${polygonName}` : '';
  if (taskStatus === 'paused') return { title: `מושהה${suffix}`, badge: 'מושהה', tone: 'warn' };
  if (taskStatus === 'finished') return { title: `סיימת חיפוש${suffix}`, badge: 'סיים חיפוש', tone: 'neutral' };
  if (taskStatus === 'searching') return { title: `בחיפוש${suffix}`, badge: 'בחיפוש', tone: 'ok' };
  return { title: `שובצת ${polygonName ? `לפוליגון ${polygonName}` : 'לפוליגון'}`, badge: 'משובץ', tone: 'accent' };
}
