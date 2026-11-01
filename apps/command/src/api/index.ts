import { ApiError, type ErrorCode } from '@trace/schemas';
import type { z } from 'zod';

/** A failed API call. `code` and `details` come from the server's shared error shape. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Validates the response. Omit for responses without a body. */
  schema?: S;
  signal?: AbortSignal;
}

/** Calls the TRACE API through the Vite proxy and validates the response with the shared zod schema. */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { method = 'GET', body, schema, signal }: RequestOptions<S> = {},
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'The server is not reachable');
  }

  if (!res.ok) {
    const parsed = ApiError.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiRequestError(res.status, code, message, details);
    }
    throw new ApiRequestError(res.status, 'INTERNAL_ERROR', `API responded ${res.status}`);
  }
  return (schema ? schema.parse(await res.json()) : undefined) as z.infer<S>;
}
