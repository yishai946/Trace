import { HealthResponse } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api';

/** How often the console checks that the server is still reachable. */
const HEALTH_INTERVAL_MS = 10_000;

/** Pings the server regularly: `navigator.onLine` alone misses a lost server or a network with no way out. */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiRequest('/health', { schema: HealthResponse, signal }),
    retry: false,
    refetchInterval: HEALTH_INTERVAL_MS,
  });
}
