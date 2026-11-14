import type { MapReport } from '@trace/map';

/** The name of a report's symbol for screen readers, e.g. "דיווח מפגע 16:44". */
export function reportLabel(report: Pick<MapReport, 'hazard' | 'located' | 'time'>): string {
  const kind = report.located ? 'הנעדר אותר' : report.hazard ? 'מפגע' : '';
  return ['דיווח', kind, report.time].filter(Boolean).join(' ');
}
