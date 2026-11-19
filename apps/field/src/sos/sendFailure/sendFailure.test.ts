import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { sosSendFailure } from '.';
import { ApiRequestError } from '../../api';

describe('sosSendFailure', () => {
  it('is null when nothing failed', () => {
    expect(sosSendFailure(null)).toBeNull();
  });

  it.each([
    ['no connection', new ApiRequestError(0, 'NETWORK_ERROR', 'No connection')],
    ['an unreachable server', new ApiRequestError(0, 'NETWORK_ERROR', 'The server is not reachable')],
    ['a timeout', new ApiRequestError(0, 'NETWORK_ERROR', 'The server did not answer in time')],
  ])('is offline for %s', (_, error) => {
    expect(sosSendFailure(error)).toBe('offline');
  });

  it.each([
    ['a server error', new ApiRequestError(500, 'INTERNAL_ERROR', 'x')],
    ['a refusal', new ApiRequestError(403, 'FORBIDDEN', 'x')],
    ['an answer that does not parse', new ZodError([])],
    ['an unknown error', new Error('x')],
  ])('is refused for %s', (_, error) => {
    expect(sosSendFailure(error)).toBe('refused');
  });
});
