import { ApiError, type ErrorCode } from '@trace/schemas';
import type { z } from 'zod';

/** The TRACE API address, e.g. `http://192.168.1.20:3001` in development. Set in `apps/field/.env.local`. */
export const apiBaseUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL?.trim() || undefined;

/** How long a request may take before it counts as a network failure, so a stalled connection cannot hang a caller. */
export const REQUEST_TIMEOUT_MS = 15_000;
/** The same for an upload (a photo's bytes), which needs longer on a weak connection. */
export const UPLOAD_TIMEOUT_MS = 60_000;

/** A failed API call. `code` and `details` come from the server's shared error shape. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: unknown,
    /** Seconds the server asks to wait before trying again (`Retry-After`). */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions<S extends z.ZodType> {
  baseUrl: string | undefined;
  /** The searcher's session token; null before sign-in. */
  token: string | null;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON. Not together with `upload`. */
  body?: unknown;
  /** Sent as it is, such as a photo's bytes, with its content type. Not together with `body`. */
  upload?: { contentType: string; data: Uint8Array<ArrayBuffer> };
  /** Validates the response. Omit for responses without a body. */
  schema?: S;
  signal?: AbortSignal;
}

function parseRetryAfter(value: string | null): number | undefined {
  return value !== null && /^\d+$/.test(value.trim()) ? Number(value) : undefined;
}

/** Calls the TRACE API with the searcher's bearer token and validates the response with the shared zod schema. */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { baseUrl, token, method = 'GET', body, upload, schema, signal }: RequestOptions<S>,
): Promise<z.infer<S>> {
  if (!baseUrl) throw new ApiRequestError(0, 'NETWORK_ERROR', 'EXPO_PUBLIC_API_URL is not set');

  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (upload) headers['content-type'] = upload.contentType;

  // One timer covers the request and reading the answer; the caller's own signal still aborts it.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    upload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  );
  const abortWithCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortWithCaller, { once: true });

  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/$/, '')}/api${path}`, {
        method,
        signal: controller.signal,
        // The bearer token is the only credential: the sign-in response also sets a cookie that must not outlive sign-out.
        credentials: 'omit',
        headers,
        body: upload ? upload.data : body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (signal?.aborted && !timedOut) throw error;
      throw new ApiRequestError(
        0,
        'NETWORK_ERROR',
        timedOut ? 'The server did not answer in time' : 'The server is not reachable',
      );
    }

    if (!res.ok) {
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
      const parsed = ApiError.safeParse(await res.json().catch(() => null));
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiRequestError(res.status, code, message, details, retryAfter);
      }
      throw new ApiRequestError(res.status, 'INTERNAL_ERROR', `API responded ${res.status}`, undefined, retryAfter);
    }
    return (schema ? schema.parse(await res.json()) : undefined) as z.infer<S>;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortWithCaller);
  }
}
