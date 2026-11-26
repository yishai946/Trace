import type { TimelineEventType } from '@trace/domain';

export type TimelineCategory =
  'search' | 'reports' | 'sos' | 'coverage' | 'boundary' | 'contact' | 'battery' | 'mission' | 'pause';

/** Filter chips in wireframe order (Cd14). A chip shows only when it has events. */
export const TIMELINE_CATEGORIES: { id: TimelineCategory; label: string }[] = [
  { id: 'search', label: 'התחלה וסיום חיפוש' },
  { id: 'reports', label: 'דיווחים ותצפיות' },
  { id: 'sos', label: 'SOS' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'boundary', label: 'יציאה מהפוליגון' },
  { id: 'contact', label: 'אובדן קשר' },
  { id: 'battery', label: 'סוללה חלשה' },
  { id: 'mission', label: 'שינויי מסע' },
  { id: 'pause', label: 'השהיה וחידוש' },
];

export const CATEGORY_OF: Record<TimelineEventType, TimelineCategory> = {
  'search.started': 'search',
  'report.submitted': 'reports',
  'sos.activated': 'sos',
  'sos.closed': 'sos',
  'coverage.threshold_reached': 'coverage',
  'searcher.left_polygon': 'boundary',
  'searcher.returned_to_polygon': 'boundary',
  'contact.lost': 'contact',
  'contact.restored': 'contact',
  'gps.lost_escalated': 'contact',
  'contact.no_updates': 'contact',
  'battery.low': 'battery',
  'mission.created': 'mission',
  'mission.ended': 'mission',
  'mission.details_changed': 'mission',
  'lkp.changed': 'mission',
  'polygon.created': 'mission',
  'polygon.boundary_changed': 'mission',
  'polygon.deleted': 'mission',
  'mission.paused': 'pause',
  'mission.resumed': 'pause',
};
