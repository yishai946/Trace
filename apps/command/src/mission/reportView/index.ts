import {
  formatCallsign,
  isCriticalReport,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
} from '@trace/domain';
import { formatLatLng, type LngLat } from '@trace/geo';
import type { MissionPolygon, Report, ReportType } from '@trace/schemas';
import { timeLabel } from '../timeLabel';

export type StatusFilter = 'all' | 'new' | 'handled';
export type TypeFilter = 'all' | ReportType;

/** The reports that match both filters, in the order they came. */
export function filterReports(reports: Report[], status: StatusFilter, type: TypeFilter): Report[] {
  return reports.filter((r) => (status === 'all' || r.status === status) && (type === 'all' || r.type === type));
}

/** How many reports each status tab holds (wireframe Cd10: "הכל 12", "חדש 3", "טופל 9"). */
export function statusCounts(reports: Report[]): Record<StatusFilter, number> {
  return {
    all: reports.length,
    new: reports.filter((r) => r.status === 'new').length,
    handled: reports.filter((r) => r.status === 'handled').length,
  };
}

/** How many reports each category chip holds. */
export function typeCounts(reports: Report[]): Record<ReportType, number> {
  return Object.fromEntries(
    REPORT_TYPES.map((type) => [type, reports.filter((r) => r.type === type).length]),
  ) as Record<ReportType, number>;
}

/** `04 דנה כהן`: the callsign with its leading zero, then the name; the name alone for the commander. */
export function reporterLabel({ reportedBy }: Pick<Report, 'reportedBy'>): string {
  return reportedBy.callsign === null ? reportedBy.name : `${formatCallsign(reportedBy.callsign)} ${reportedBy.name}`;
}

export function polygonLabel(report: Pick<Report, 'polygonId'>, polygons: MissionPolygon[]): string {
  if (report.polygonId === null) return 'ללא פוליגון';
  return polygons.find((p) => p.id === report.polygonId)?.name ?? 'פוליגון שנמחק';
}

/** The row's title: what the searcher wrote; for a located report its category, which says it all. */
export function listTitle(report: Pick<Report, 'type' | 'text'>): string {
  return report.type === 'located' ? REPORT_TYPE_LABELS.located : report.text;
}

/** The row's second line, in the wireframe's order (Cd10): category, reporter, polygon, time. */
export function listMeta(report: Report, polygons: MissionPolygon[]): string {
  return [
    REPORT_TYPE_LABELS[report.type],
    reporterLabel(report),
    polygonLabel(report, polygons),
    timeLabel(report.reportedAt),
  ].join(', ');
}

/** `31.7452, 35.0118, ±5 מ׳`; the accuracy only when the phone reported it. */
export function positionLabel(report: Pick<Report, 'position' | 'accuracy'>): string {
  const position = formatLatLng(report.position.coordinates as LngLat);
  return report.accuracy === null ? position : `${position}, ±${Math.round(report.accuracy)} מ׳`;
}

/** The Inspector's sub line: "דיווח, חדש", and for a New located report that it awaits verification. */
export function inspectorSub(report: Pick<Report, 'type' | 'status'>): string {
  const parts = ['דיווח', REPORT_STATUS_LABELS[report.status]];
  if (isCriticalReport(report)) parts.push('ממתין לאימות');
  return parts.join(', ');
}
