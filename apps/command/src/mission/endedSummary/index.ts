import type { Mission, MissionPolygon, Participant } from '@trace/schemas';

/** When the commander ended the mission, or null while it is live. */
export function endedAt(mission: Mission): string | null {
  return mission.located?.endedAt ?? mission.stopped?.endedAt ?? null;
}

/** "06:29:14": hours, minutes and seconds, each with two digits. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const part = (n: number) => String(n).padStart(2, '0');
  return `${part(Math.floor(total / 3600))}:${part(Math.floor((total % 3600) / 60))}:${part(total % 60)}`;
}

/** How long the mission ran, from its creation to its end; null while it is live. */
export function missionDuration(mission: Mission): string | null {
  const end = endedAt(mission);
  return end ? formatDuration(new Date(end).getTime() - new Date(mission.createdAt).getTime()) : null;
}

export interface CoverageRow {
  id: string;
  name: string;
  /** The rounded coverage; null for a polygon nobody was assigned to. */
  percent: number | null;
  label: string;
  status: MissionPolygon['status'];
}

/** The final coverage of each polygon (wireframe Cd15): the percent, or "לא שובץ" when it never had searchers. */
export function coverageRows(polygons: MissionPolygon[]): CoverageRow[] {
  return polygons.map(({ id, name, status, coverage }) => {
    const percent = status === 'unassigned' ? null : Math.round(coverage ?? 0);
    return { id, name, percent, label: percent === null ? 'לא שובץ' : `${percent}%`, status };
  });
}

/** Safety continues until every searcher finishes their activity (UC-F13), so some may still be in the field. */
export function stillInField(participants: Participant[]): number {
  return participants.filter((p) => p.status !== 'ended').length;
}
