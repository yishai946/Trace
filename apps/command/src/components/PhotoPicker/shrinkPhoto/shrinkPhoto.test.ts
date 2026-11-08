import { describe, expect, it } from 'vitest';
import { fitWithin, PHOTO_MAX_SIDE } from '.';

describe('fitWithin', () => {
  it('shrinks the long side to the limit and keeps the ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: PHOTO_MAX_SIDE, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: PHOTO_MAX_SIDE });
  });

  it('leaves a small photo at its size', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
