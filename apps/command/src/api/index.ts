import { request } from '@trace/api-client';
import type { z } from 'zod';

export { ApiRequestError } from '@trace/api-client';

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON, or as is with its own type when it is a file. */
  body?: unknown;
  /** Validates the response. Omit for responses without a body. */
  schema?: S;
  signal?: AbortSignal;
}

function encode(body: unknown): { headers?: Record<string, string>; body?: BodyInit } {
  if (body === undefined) return {};
  if (body instanceof Blob) return { headers: { 'content-type': body.type }, body };
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

/** Calls the TRACE API through the Vite proxy and validates the response with the shared zod schema. */
export function apiRequest<S extends z.ZodType>(
  path: string,
  options: RequestOptions<S> & { schema: S },
): Promise<z.infer<S>>;
/** A response without a body: resolves to undefined. */
export function apiRequest(
  path: string,
  options?: RequestOptions<z.ZodType> & { schema?: undefined },
): Promise<undefined>;
export function apiRequest<S extends z.ZodType>(
  path: string,
  { method = 'GET', body, schema, signal }: RequestOptions<S> = {},
): Promise<z.infer<S> | undefined> {
  return request(`/api${path}`, { method, schema, signal, ...encode(body) });
}
