import { ApiRequestError } from '../../api';

/**
 * Why an SOS was not sent or closed (UC-F13). `offline`: the phone has no connection, or the server could not be
 * reached in time. `ended`: 409 PARTICIPATION_ENDED, the searcher's activity has ended. `forbidden`: 403, the server
 * does not let this user do it. `refused`: any other error answer, or an answer that could not be read.
 */
export type SosSendFailure = 'offline' | 'ended' | 'forbidden' | 'refused';

export function sosSendFailure(error: unknown): SosSendFailure | null {
  if (!error) return null;
  if (!(error instanceof ApiRequestError)) return 'refused';
  if (error.code === 'NETWORK_ERROR') return 'offline';
  if (error.status === 409 && error.code === 'PARTICIPATION_ENDED') return 'ended';
  if (error.status === 403) return 'forbidden';
  return 'refused';
}
