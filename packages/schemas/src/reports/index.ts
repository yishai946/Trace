import { REPORT_STATUSES, REPORT_TYPES, USER_ROLES } from '@trace/domain';
import { z } from 'zod';
import { PointGeometry } from '../geo';

/** The longest report text: a technical bound, the same as a sighting's description. */
export const REPORT_TEXT_MAX = 2000;

export const ReportType = z.enum(REPORT_TYPES).meta({ id: 'ReportType' });
export const ReportStatus = z.enum(REPORT_STATUSES).meta({ id: 'ReportStatus' });

// A request body with a default has no OpenAPI component id: its input and output differ.

/** A field report (UC-F09, decisions 15, 16): a category, text and the searcher's position; the photo goes separately. */
export const CreateReportBody = z.object({
  /** Made on the phone (UUIDv7). Sending it again returns the report already saved, not a second one. */
  id: z.uuid(),
  type: ReportType,
  text: z.string().trim().min(1).max(REPORT_TEXT_MAX),
  position: PointGeometry,
  /** Horizontal accuracy in meters, when the phone reports it. */
  accuracy: z.number().min(0).max(100_000).nullable().default(null),
  /** When the searcher sent it on the phone, not when it arrived: an offline report arrives later. */
  reportedAt: z.iso.datetime({ offset: true }),
});

export const Report = z
  .object({
    id: z.uuid(),
    missionId: z.uuid(),
    /** The searcher's polygon when the server received the report; null for an Available searcher (decision 80). */
    polygonId: z.uuid().nullable(),
    type: ReportType,
    status: ReportStatus,
    text: z.string(),
    position: PointGeometry,
    accuracy: z.number().nullable(),
    reportedAt: z.iso.datetime({ offset: true }),
    reportedBy: z.object({
      role: z.enum(USER_ROLES),
      name: z.string(),
      /** The searcher's callsign in this mission; null for the commander. */
      callsign: z.number().int().nullable(),
    }),
    hasPhoto: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: 'Report' });

export const ReportParams = z.object({ missionId: z.uuid(), reportId: z.uuid() });

export type ReportType = z.infer<typeof ReportType>;
export type ReportStatus = z.infer<typeof ReportStatus>;
export type CreateReportBody = z.input<typeof CreateReportBody>;
export type Report = z.infer<typeof Report>;
