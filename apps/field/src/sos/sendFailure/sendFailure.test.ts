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

  it('is ended when the activity of the searcher has ended (409 PARTICIPATION_ENDED)', () => {
    expect(sosSendFailure(new ApiRequestError(409, 'PARTICIPATION_ENDED', 'x'))).toBe('ended');
  });

  it('is forbidden when the server refuses the searcher (403)', () => {
    expect(sosSendFailure(new ApiRequestError(403, 'FORBIDDEN', 'x'))).toBe('forbidden');
  });

  it('is refused for another conflict', () => {
    expect(sosSendFailure(new ApiRequestError(409, 'MISSION_ENDED', 'x'))).toBe('refused');
  });

  it.each([
    ['a server error', new ApiRequestError(500, 'INTERNAL_ERROR', 'x')],
    ['an answer that does not parse', new ZodError([])],
    ['an unknown error', new Error('x')],
  ])('is refused for %s', (_, error) => {
    expect(sosSendFailure(error)).toBe('refused');
  });
});
