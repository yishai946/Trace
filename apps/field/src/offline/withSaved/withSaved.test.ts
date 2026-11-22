import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { withSaved } from './index';

type Q = Pick<
  UseQueryResult<string>,
  'data' | 'isPending' | 'isError' | 'isFetching' | 'fetchStatus' | 'refetch' | 'failureCount'
>;
const query = (over: Partial<Q> = {}) =>
  ({
    data: undefined,
    isPending: true,
    isError: false,
    isFetching: true,
    fetchStatus: 'fetching',
    refetch: () => Promise.reject(new Error('unused')),
    failureCount: 0,
    ...over,
  }) as UseQueryResult<string>;
const saved = (data: string | null | undefined, isLoading = false) => ({ data, isLoading });

describe('withSaved', () => {
  it('prefers the server data and shows no warning', () => {
    const result = withSaved(query({ data: 'server', isPending: false }), saved('phone'));
    expect(result).toMatchObject({ data: 'server', isPending: false, notUpToDate: false });
  });

  it('shows the saved copy at once while the server is asked, without a warning', () => {
    const result = withSaved(query(), saved('phone'));
    expect(result).toMatchObject({ data: 'phone', isPending: false, isError: false, notUpToDate: false });
  });

  it('warns once a request failed and the saved copy is what shows', () => {
    expect(withSaved(query({ failureCount: 1 }), saved('phone')).notUpToDate).toBe(true);
    const failed = withSaved(query({ isError: true, isPending: false, isFetching: false }), saved('phone'));
    expect(failed).toMatchObject({ data: 'phone', isError: false, notUpToDate: true });
  });

  it('is an error, not a stale copy, when nothing is saved', () => {
    const result = withSaved(query({ isError: true, isPending: false }), saved(null));
    expect(result).toMatchObject({ data: undefined, isError: true, notUpToDate: false });
  });

  it('waits for the saved copy before calling a failure an error', () => {
    const result = withSaved(query({ isError: true, isPending: false }), saved(undefined, true));
    expect(result.isError).toBe(false);
  });
});
