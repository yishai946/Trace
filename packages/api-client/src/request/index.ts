import { ApiError } from '@trace/schemas';
import type { z } from 'zod';
import { ApiRequestError } from '../ApiRequestError';
import { withTimeout } from '../timeout';

export interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: BodyInit;
  /** Validates the response. Omit for responses without a body. */
  schema?: S;
  signal?: AbortSignal;
  /** Gives up after this long and counts as a network failure. Without it the request is limited by `signal` only. */
  timeoutMs?: number;
  credentials?: RequestCredentials;
}

function parseRetryAfter(value: string | null): number | undefined {
  return value !== null && /^\d+$/.test(value.trim()) ? Number(value) : undefined;
}

/** The failure the server answered with, in its shared error shape. */
async function failureOf(res: Response): Promise<ApiRequestError> {
  const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
  const parsed = ApiError.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    return new ApiRequestError(res.status, 'INTERNAL_ERROR', `API responded ${res.status}`, undefined, retryAfter);
  }
  const { code, message, details } = parsed.data.error;
  return new ApiRequestError(res.status, code, message, details, retryAfter);
}

/** Sends the request. A failure to get an answer is a network error, except the caller's own abort. */
async function send<S extends z.ZodType>(
  url: string,
  { method = 'GET', headers, body, signal, credentials }: RequestOptions<S>,
  limit: ReturnType<typeof withTimeout> | undefined,
): Promise<Response> {
  try {
    return await fetch(url, {
      method,
      signal: limit ? limit.signal : signal,
      ...(credentials && { credentials }),
      ...(headers && { headers }),
      ...(body !== undefined && { body }),
    });
  } catch (error) {
    const timedOut = limit?.timedOut() ?? false;
    if (signal?.aborted && !timedOut) throw error;
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      timedOut ? 'The server did not answer in time' : 'The server is not reachable',
    );
  }
}

/** Calls a TRACE API URL and validates the response with the shared zod schema. Failures are `ApiRequestError`s. */
export async function request<S extends z.ZodType>(url: string, options: RequestOptions<S> = {}): Promise<z.infer<S>> {
  const { schema, signal, timeoutMs } = options;
  // One timer covers the request and reading the answer; the caller's own signal still aborts it.
  const limit = timeoutMs === undefined ? undefined : withTimeout(signal, timeoutMs);
  try {
    const res = await send(url, options, limit);
    if (!res.ok) throw await failureOf(res);
    return (schema ? schema.parse(await res.json()) : undefined) as z.infer<S>;
  } finally {
    limit?.dispose();
  }
}
