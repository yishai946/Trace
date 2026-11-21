import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';
import { updateOpened } from '.';
import { addOnce } from '../listUpdates';

const key = ['missions', 'm1', 'reports'] as const;
const a = { id: 'a' };
const b = { id: 'b' };

describe('updateOpened', () => {
  it('changes a list that is cached', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, [a]);
    updateOpened(queryClient, key, addOnce(b));
    expect(queryClient.getQueryData(key)).toEqual([a, b]);
  });

  it('does not create a list that was never opened, and fetches it again', async () => {
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, 'cancelQueries');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    updateOpened(queryClient, key, addOnce(b));
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: key }));
    expect(cancel).toHaveBeenCalledWith({ queryKey: key });
    expect(queryClient.getQueryData(key)).toBeUndefined();
  });

  it('starts an in-flight first fetch again, so it cannot miss the event', async () => {
    const queryClient = new QueryClient();
    let release: () => void = () => undefined;
    const queryFn = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve([]))))
      .mockResolvedValue([b]);
    // A mounted screen observes its list, so a cancelled fetch is started again once the list is invalidated.
    const unsubscribe = new QueryObserver(queryClient, { queryKey: key, queryFn, retry: false }).subscribe(
      () => undefined,
    );

    updateOpened(queryClient, key, addOnce(b));
    release();
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    unsubscribe();
  });
});
