import { CreateReportBody, Report } from '@trace/schemas';
import { z } from 'zod';
import { ApiRequestError, apiBaseUrl, apiRequest } from '../../api';
import type { OutboxSender } from '../../outbox';
import { useSession } from '../../state/session';

/** What a queued photo holds: the report it belongs to and the JPEG, already shrunk on the phone, as base64. */
export const ReportPhotoPayload = z.object({ reportId: z.uuid(), base64: z.string().min(1) });
export type ReportPhotoPayload = z.infer<typeof ReportPhotoPayload>;

function token(): string {
  const { token } = useSession.getState();
  if (!token) throw new Error('Not signed in');
  return token;
}

/**
 * Sends a queued field report to `POST /missions/:id/reports` (UC-F09), one at a time. The report's id is made on the
 * phone, so the server answers 200 with the saved report when this one already arrived, and a send that was made but not
 * confirmed is safe to repeat. A refusal that cannot change (the mission or the activity ended, access gone) drops the
 * mission's reports; a network or server error keeps them.
 */
export const reportSender: OutboxSender = {
  batchSize: 1,
  async send(missionId, items) {
    const parsed = CreateReportBody.safeParse(items[0]?.payload);
    if (!parsed.success) return 'drop-batch';
    const bearer = token();
    try {
      await apiRequest(`/missions/${missionId}/reports`, {
        baseUrl: apiBaseUrl,
        token: bearer,
        method: 'POST',
        body: parsed.data,
        schema: Report,
      });
      return 'sent';
    } catch (error) {
      if (!(error instanceof ApiRequestError)) throw error;
      if (error.code === 'REPORT_ID_TAKEN' || error.status === 400) return 'drop-batch';
      if (error.status === 409 || error.status === 404 || error.status === 403) return 'drop-mission';
      throw error;
    }
  },
};

function bytesOf(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Sends a queued report photo to `PUT /missions/:id/reports/:reportId/photo`, one at a time, after its report. A
 * refusal drops only this photo: the report is already there, and one photo is not worth the mission's other photos.
 */
export const reportPhotoSender: OutboxSender = {
  batchSize: 1,
  async send(missionId, items) {
    const parsed = ReportPhotoPayload.safeParse(items[0]?.payload);
    if (!parsed.success) return 'drop-batch';
    const bearer = token();
    try {
      await apiRequest(`/missions/${missionId}/reports/${parsed.data.reportId}/photo`, {
        baseUrl: apiBaseUrl,
        token: bearer,
        method: 'PUT',
        upload: { contentType: 'image/jpeg', data: bytesOf(parsed.data.base64) },
        schema: Report,
      });
      return 'sent';
    } catch (error) {
      if (!(error instanceof ApiRequestError)) throw error;
      if ([400, 403, 404, 409, 413, 415].includes(error.status)) return 'drop-batch';
      throw error;
    }
  },
};
