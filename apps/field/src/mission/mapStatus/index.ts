export interface MapStatusInput {
  /** `EXPO_PUBLIC_API_URL` is set. */
  apiConfigured: boolean;
  signedIn: boolean;
  missionId: string | null;
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
}

export type MapStatus = 'no-api' | 'signed-out' | 'no-mission' | 'loading' | 'error';

/** What the map screen tells the searcher while it cannot show the mission area; null once it can. */
export function mapStatus(input: MapStatusInput): MapStatus | null {
  if (!input.apiConfigured) return 'no-api';
  if (!input.signedIn) return 'signed-out';
  if (!input.missionId) return 'no-mission';
  if (input.isFetching && !input.hasData) return 'loading';
  if (input.isError && !input.hasData) return 'error';
  return null;
}
