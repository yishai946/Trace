import { ApiRequestError } from '../../api';

/**
 * Why an SOS was not delivered (UC-F13). `offline`: the phone has no connection, or the server could not be reached in
 * time. `refused`: the server answered with an error, or the answer could not be read.
 */
export type SosSendFailure = 'offline' | 'refused';

export function sosSendFailure(error: unknown): SosSendFailure | null {
  if (!error) return null;
  return error instanceof ApiRequestError && error.code === 'NETWORK_ERROR' ? 'offline' : 'refused';
}
