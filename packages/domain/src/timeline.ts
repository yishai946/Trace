/**
 * Significant mission events recorded on the operational Timeline (UC-C19, decision 54). Insignificant events
 * (such as renaming a polygon) are not recorded. Types whose triggering action does not exist yet are listed so
 * the issues that add those actions can record them.
 */
export const TIMELINE_EVENT_TYPES = [
  'mission.created',
  'mission.paused',
  'mission.resumed',
  'mission.ended',
  'lkp.changed',
  'polygon.created',
  'polygon.boundary_changed',
  'polygon.deleted',
  'polygon.completed',
  'polygon.reactivated',
  'search.started',
  'report.submitted',
  'coverage.threshold_reached',
  'contact.lost',
  'contact.restored',
  'searcher.left_polygon',
  'searcher.returned_to_polygon',
  'battery.low',
  'gps.lost_escalated',
  'contact.no_updates',
  'sos.activated',
  'sos.closed',
  'mission.details_changed',
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
