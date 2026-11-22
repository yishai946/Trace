import { describe, expect, it } from 'vitest';
import { targetLabel } from '.';

describe('targetLabel', () => {
  it('names the whole mission, the polygons and a personal message', () => {
    expect(targetLabel({ kind: 'mission' })).toBe('כלל המסע');
    expect(targetLabel({ kind: 'polygons', polygons: [{ name: 'A' }, { name: 'B' }] })).toBe('A, B');
    expect(targetLabel({ kind: 'searcher' })).toBe('אישי');
  });
});
