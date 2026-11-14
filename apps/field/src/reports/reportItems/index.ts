import { compareReportsNewestFirst, REPORT_TYPE_LABELS } from '@trace/domain';
import { distanceMeters, type LngLat } from '@trace/geo';
import type { MapReport } from '@trace/map';
import type { CreateReportBody, MissionPolygon, OwnParticipation, Report, ReportType } from '@trace/schemas';
import { formatTime } from '../../mission/missionArea';
import { isMine, visibleReports } from '../reportVisibility';

/** One report as the list and the map show it (UC-F11, wireframe Fm10). */
export interface ReportItem {
  id: string;
  type: ReportType;
  typeLabel: string;
  text: string;
  /** The hour it was sent, e.g. `16:44`. */
  time: string;
  position: LngLat;
  mine: boolean;
  /** The author's callsign and name; for a report that waits on this phone, my own callsign and no name. */
  callsign: number | null;
  name: string;
  polygonId: string | null;
  polygonName: string | null;
  /** From the searcher's phone to the report; null for their own reports and while the position is unknown. */
  distanceMeters: number | null;
  photoUrl: string | null;
  /** Saved on the phone and not yet on the server. */
  pending: boolean;
  located: boolean;
  hazard: boolean;
}

export type ReportFilter = 'polygon' | 'mine';

interface Input {
  reports: Report[];
  /** Reports of the mission that wait in the outbox. */
  pending: CreateReportBody[];
  participation: OwnParticipation | null;
  polygons: Pick<MissionPolygon, 'id' | 'name'>[];
  /** The searcher's position, for the distances. */
  from: LngLat | null;
}

/**
 * The reports the searcher sees, newest first: the polygon's and their own from the server (decision 80), plus their own
 * that still wait on the phone. A report the server already has is not shown twice.
 */
export function toReportItems({ reports, pending, participation, polygons, from }: Input): ReportItem[] {
  if (!participation) return [];
  const names = new Map(polygons.map((p) => [p.id, p.name]));
  const polygonName = (id: string | null) => (id ? (names.get(id) ?? null) : null);
  const known = new Set(reports.map((r) => r.id));
  const myPolygonId = participation.status === 'assigned' ? participation.polygonId : null;

  const sent = visibleReports(reports, participation).map((report) => {
    const mine = isMine(report, participation);
    const position = report.position.coordinates as LngLat;
    return {
      sortKey: report.reportedAt,
      item: {
        id: report.id,
        type: report.type,
        typeLabel: REPORT_TYPE_LABELS[report.type],
        text: report.text,
        time: formatTime(report.reportedAt),
        position,
        mine,
        callsign: report.reportedBy.callsign,
        name: report.reportedBy.name,
        polygonId: report.polygonId,
        polygonName: polygonName(report.polygonId),
        distanceMeters: !mine && from ? distanceMeters(from, position) : null,
        photoUrl: report.photoUrl,
        pending: false,
        located: report.type === 'located',
        hazard: report.type === 'hazard',
      } satisfies ReportItem,
    };
  });
  const waiting = pending
    .filter((body) => !known.has(body.id))
    .map((body) => ({
      sortKey: body.reportedAt,
      item: {
        id: body.id,
        type: body.type,
        typeLabel: REPORT_TYPE_LABELS[body.type],
        text: body.text,
        time: formatTime(body.reportedAt),
        position: body.position.coordinates as LngLat,
        mine: true,
        callsign: participation.callsign,
        name: '',
        polygonId: myPolygonId,
        polygonName: polygonName(myPolygonId),
        distanceMeters: null,
        photoUrl: null,
        pending: true,
        located: body.type === 'located',
        hazard: body.type === 'hazard',
      } satisfies ReportItem,
    }));

  const at = (iso: string) => ({ reportedAt: iso, createdAt: iso });
  return [...sent, ...waiting]
    .sort((a, b) => compareReportsNewestFirst(at(a.sortKey), at(b.sortKey)))
    .map(({ item }) => item);
}

/** "In my polygon" (what was sent from it, mine included) or "mine" (from any polygon). */
export function filterItems(items: ReportItem[], filter: ReportFilter, myPolygonId: string | null): ReportItem[] {
  return filter === 'mine'
    ? items.filter((item) => item.mine)
    : items.filter((item) => myPolygonId !== null && item.polygonId === myPolygonId);
}

/** The symbols the map draws for these reports. */
export function toMapReports(items: ReportItem[]): MapReport[] {
  return items.map((item) => ({
    id: item.id,
    position: item.position,
    time: item.time,
    hazard: item.hazard,
    located: item.located,
  }));
}

/** "120 מ׳ ממני": to the nearest ten meters under a kilometer, in kilometers with one decimal from there. */
export function formatDistance(meters: number): string {
  const tens = Math.round(meters / 10) * 10;
  return tens >= 1000 ? `${(meters / 1000).toFixed(1)} ק״מ ממני` : `${tens} מ׳ ממני`;
}
