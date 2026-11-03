import type { MissionStatus } from '@trace/domain';

/** How each mission status reads in the list (wireframe Cd02): a word and the state of its dot. */
export const MISSION_STATUS_LABELS: Record<MissionStatus, { label: string; tone: 'ok' | 'warn' | 'ended' }> = {
  active: { label: 'פעיל', tone: 'ok' },
  paused: { label: 'מושהה', tone: 'warn' },
  ended_located: { label: 'הסתיים, אותר', tone: 'ended' },
  ended_stopped: { label: 'הסתיים, הופסק', tone: 'ended' },
};

const time = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayMonth = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' });
const fullDate = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** When a mission was opened, as the list shows it: "היום 11:16", "אתמול 22:40", "01.10, 14:05" or "01.10.2025". */
export function formatOpened(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, now)) return `היום ${time.format(date)}`;
  if (sameDay(date, yesterday)) return `אתמול ${time.format(date)}`;
  if (date.getFullYear() === now.getFullYear()) return `${dayMonth.format(date)}, ${time.format(date)}`;
  return fullDate.format(date);
}
