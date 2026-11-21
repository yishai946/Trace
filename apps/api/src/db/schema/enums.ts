import {
  LKP_DECISIONS,
  MESSAGE_TARGET_KINDS,
  MESSAGE_URGENCIES,
  MISSION_STATUSES,
  PARTICIPATION_STATUSES,
  POLYGON_STATUSES,
  REPORT_STATUSES,
  REPORT_TYPES,
  SIGHTING_SOURCES,
  SOS_STATUSES,
  TASK_STATUSES,
  TIMELINE_EVENT_TYPES,
  TRACK_CONTEXTS,
  USER_ROLES,
} from '@trace/domain';
import { pgEnum } from 'drizzle-orm/pg-core';

export const missionStatus = pgEnum('mission_status', MISSION_STATUSES);
export const polygonStatus = pgEnum('polygon_status', POLYGON_STATUSES);
export const reportType = pgEnum('report_type', REPORT_TYPES);
export const reportStatus = pgEnum('report_status', REPORT_STATUSES);
export const participationStatus = pgEnum('participation_status', PARTICIPATION_STATUSES);
export const taskStatus = pgEnum('task_status', TASK_STATUSES);
export const userRole = pgEnum('user_role', USER_ROLES);
export const sightingSource = pgEnum('sighting_source', SIGHTING_SOURCES);
export const lkpDecision = pgEnum('lkp_decision', LKP_DECISIONS);
export const timelineEventType = pgEnum('timeline_event_type', TIMELINE_EVENT_TYPES);
export const trackContext = pgEnum('track_context', TRACK_CONTEXTS);
export const sosStatus = pgEnum('sos_status', SOS_STATUSES);

export const messageUrgency = pgEnum('message_urgency', MESSAGE_URGENCIES);
export const messageTargetKind = pgEnum('message_target_kind', MESSAGE_TARGET_KINDS);
