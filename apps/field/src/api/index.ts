import { ApiRequestError, request, requestBytes, type BytesResponse } from '@trace/api-client';
import type { z } from 'zod';

export { ApiRequestError };

/** The TRACE API address, e.g. `http://192.168.1.20:3001` in development. Set in `apps/field/.env.local`. */
export const apiBaseUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL?.trim() || undefined;

/** How long a request may take before it counts as a network failure, so a stalled connection cannot hang a caller. */
export const REQUEST_TIMEOUT_MS = 15_000;
/** The same for an upload (a photo's bytes), which needs longer on a weak connection. */
export const UPLOAD_TIMEOUT_MS = 60_000;

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

function headersOf({ token, body, upload }: Pick<RequestOptions<z.ZodType>, 'token' | 'body' | 'upload'>) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (upload) headers['content-type'] = upload.contentType;
  return headers;
}

/** Calls the TRACE API with the searcher's bearer token and validates the response with the shared zod schema. */
export function apiRequest<S extends z.ZodType>(
  path: string,
  options: RequestOptions<S> & { schema: S },
): Promise<z.infer<S>>;
/** A response without a body: resolves to undefined. */
export function apiRequest(
  path: string,
  options: RequestOptions<z.ZodType> & { schema?: undefined },
): Promise<undefined>;
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { baseUrl, token, method = 'GET', body, upload, schema, signal }: RequestOptions<S>,
): Promise<z.infer<S> | undefined> {
  if (!baseUrl) throw new ApiRequestError(0, 'NETWORK_ERROR', 'EXPO_PUBLIC_API_URL is not set');
  return request(`${baseUrl.replace(/\/$/, '')}/api${path}`, {
    method,
    schema,
    signal,
    // The bearer token is the only credential: the sign-in response also sets a cookie that must not outlive sign-out.
    credentials: 'omit',
    headers: headersOf({ token, body, upload }),
    body: upload ? upload.data : body === undefined ? undefined : JSON.stringify(body),
    timeoutMs: upload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  });
}

/** Downloads a file the API serves to members, such as the missing person's photo (UC-F04). `path` is the address the server gave, `/api/...` included. */
export function apiBytes(
  path: string,
  { baseUrl, token, signal }: { baseUrl: string | undefined; token: string | null; signal?: AbortSignal },
): Promise<BytesResponse> {
  if (!baseUrl) throw new ApiRequestError(0, 'NETWORK_ERROR', 'EXPO_PUBLIC_API_URL is not set');
  return requestBytes(`${baseUrl.replace(/\/$/, '')}${path}`, {
    signal,
    credentials: 'omit',
    headers: headersOf({ token, body: undefined, upload: undefined }),
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}
