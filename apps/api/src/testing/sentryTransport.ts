import { createTransport } from '@sentry/node';

/** A Sentry transport that keeps the events it is given instead of sending them, so no test reaches the network. */
export function createFakeSentryTransport() {
  const events: Array<Record<string, unknown>> = [];
  const factory = (options: Parameters<typeof createTransport>[0]) =>
    createTransport(options, async (request) => {
      for (const line of String(request.body).split('\n')) {
        try {
          const item: unknown = JSON.parse(line);
          if (typeof item === 'object' && item && 'event_id' in item && ('exception' in item || 'message' in item)) {
            events.push({ ...item });
          }
        } catch {
          // Not a JSON line (a binary attachment); not an event either.
        }
      }
      return { statusCode: 200 };
    });
  return { events, factory };
}
