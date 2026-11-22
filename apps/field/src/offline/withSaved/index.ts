import type { UseQueryResult } from '@tanstack/react-query';

/** The part of a query result the screens read, with the copy saved on the phone filling in when the server gave nothing. */
export interface QueryWithSaved<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: UseQueryResult<T>['fetchStatus'];
  refetch: UseQueryResult<T>['refetch'];
  /** The data on screen is the copy saved on the phone and the server could not be reached: it may be out of date (UC-F04). */
  notUpToDate: boolean;
}

/**
 * Shows the server's answer when there is one, and otherwise the last copy saved on the phone (UC-F04). While the server
 * is still being asked the saved copy shows without a warning; the warning appears once a request has failed. A
 * request that fails does not turn into an error screen while a saved copy can be shown.
 */
export function withSaved<T>(
  query: UseQueryResult<T>,
  saved: Pick<UseQueryResult<T | null>, 'data' | 'isLoading'>,
): QueryWithSaved<T> {
  const copy = saved.data ?? undefined;
  const data = query.data ?? copy;
  const fromPhone = query.data === undefined && copy !== undefined;
  return {
    data,
    isPending: query.isPending && data === undefined,
    isError: query.isError && data === undefined && !saved.isLoading,
    isFetching: query.isFetching,
    fetchStatus: query.fetchStatus,
    refetch: query.refetch,
    notUpToDate: fromPhone && (query.isError || query.failureCount > 0),
  };
}
