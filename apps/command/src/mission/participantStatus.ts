import type { Participant } from '@trace/schemas';

/** The searcher's state in words, as in wireframe Cd08. */
export function statusLabel(p: Pick<Participant, 'status' | 'taskStatus'>): string {
  if (p.status === 'available') return 'זמין';
  if (p.status === 'ended') return 'סיים';
  if (p.taskStatus === 'searching') return 'בחיפוש';
  if (p.taskStatus === 'paused') return 'מושהה';
  return 'משובץ';
}
