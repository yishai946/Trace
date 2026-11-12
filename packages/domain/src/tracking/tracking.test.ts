import { describe, expect, it } from 'vitest';
import { acceptsTrackPoints, trackContextOf } from '.';

describe('trackContextOf', () => {
  it('counts a point toward the search only while searching', () => {
    expect(trackContextOf('searching')).toBe('search');
    expect(trackContextOf('paused')).toBe('safety');
    expect(trackContextOf('ready')).toBe('safety');
    expect(trackContextOf('finished')).toBe('safety');
    expect(trackContextOf(null)).toBe('safety');
  });
});

describe('acceptsTrackPoints', () => {
  it('takes points until the activity ended', () => {
    expect(acceptsTrackPoints('available')).toBe(true);
    expect(acceptsTrackPoints('assigned')).toBe(true);
    expect(acceptsTrackPoints('ended')).toBe(false);
  });
});
