import type { QueryClient, QueryKey } from '@tanstack/query-core';
import type { ListUpdate } from '../listUpdates';

/**
 * Changes a list that is fetched when its screen opens. Not cached means it was never opened, or its first fetch is in
 * flight and may have read the server before this event: that fetch is cancelled and started again (an in-flight first
 * fetch is otherwise reused), so it cannot leave the list without the event. Nothing happens if it was never opened.
 */
export function updateOpened<T>(queryClient: QueryClient, key: QueryKey, update: ListUpdate<T>): void {
  if (!queryClient.getQueryData(key)) {
    void queryClient.cancelQueries({ queryKey: key }).then(() => queryClient.invalidateQueries({ queryKey: key }));
    return;
  }
  queryClient.setQueryData<T[]>(key, update);
}
