import { compareReportsNewestFirst } from '@trace/domain';
import type { Report, Sos } from '@trace/schemas';
import { removeById, upsertById, type ListUpdate } from '../listUpdates';

// Both sorts are stable, so items of the same instant keep their arrival order.
const reportsNewestFirst = (list: Report[], report: Report) => [...list, report].sort(compareReportsNewestFirst);
const sosNewestFirst = (list: Sos[], sos: Sos) =>
  [...list, sos].sort((a, b) => Date.parse(b.activatedAt) - Date.parse(a.activatedAt));

/** Puts a report in the list (replacing the one with its id), newest first, as the server lists them. */
export const upsertReport = (report: Report): ListUpdate<Report> => upsertById(report, reportsNewestFirst);
export const removeReport = (reportId: string): ListUpdate<Report> => removeById<Report>(reportId);
/** Puts an SOS in the list (replacing the one with its id), newest first, as the server lists them. */
export const upsertSos = (sos: Sos): ListUpdate<Sos> => upsertById(sos, sosNewestFirst);
