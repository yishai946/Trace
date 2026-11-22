import type { z } from 'zod';
import { failureOf, send, type RequestOptions } from '../request';
import { withTimeout } from '../timeout';

export interface BytesResponse {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
}

/** Calls a TRACE API URL that answers with a file (such as a photo) and returns its bytes. Failures are `ApiRequestError`s. */
export async function requestBytes(
  url: string,
  options: Omit<RequestOptions<z.ZodType>, 'schema' | 'body' | 'method'> = {},
): Promise<BytesResponse> {
  const limit = options.timeoutMs === undefined ? undefined : withTimeout(options.signal, options.timeoutMs);
  try {
    const res = await send(url, options, limit);
    if (!res.ok) throw await failureOf(res);
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  } finally {
    limit?.dispose();
  }
}
