import type { ErrorCode } from '@trace/schemas';

/** A failed API call. `code` and `details` come from the server's shared error shape. */
export class ApiRequestError extends Error {
  // eslint-disable-next-line max-params -- positional by design: every call site builds it from a response's fields
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
