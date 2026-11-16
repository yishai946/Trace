import { Report, type CreateReportBody } from '@trace/schemas';
import { apiBaseUrl, apiRequest } from '../api';

/** `POST /missions/:id/reports`: the saved report, also for a report id the server already has. */
export function postReport(missionId: string, token: string, body: CreateReportBody) {
  return apiRequest(`/missions/${missionId}/reports`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'POST',
    body,
    schema: Report,
  });
}

/** `PUT /missions/:id/reports/:reportId/photo`: the report's photo, a JPEG. */
export function putReportPhoto(missionId: string, token: string, reportId: string, data: Uint8Array<ArrayBuffer>) {
  return apiRequest(`/missions/${missionId}/reports/${reportId}/photo`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'PUT',
    upload: { contentType: 'image/jpeg', data },
    schema: Report,
  });
}
