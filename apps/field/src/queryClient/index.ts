import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { reportQueryError } from '../monitoring';

// Mutations run even with no connection ('always'), so a form that cannot reach the server fails at
// once and shows its error. With the default ('online') react-query pauses them, the form stays on
// "saving…" and the request is sent silently later. Offline sending is the outbox's job (UC-S03), not the cache's.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: reportQueryError }),
    mutationCache: new MutationCache({ onError: reportQueryError }),
    defaultOptions: { mutations: { networkMode: 'always' } },
  });
}
