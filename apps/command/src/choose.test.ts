import { describe, expect, it } from 'vitest';
import { choose, chooseFirst } from './choose';

const options = ['all', 'new'] as const;

describe('choose', () => {
  it('returns the option a key stands for, else the fallback', () => {
    expect(choose(options, 'new', 'all')).toBe('new');
    expect(choose(options, 'other', 'all')).toBe('all');
    expect(choose(options, undefined, 'all')).toBe('all');
    expect(choose(options, 3, 'all')).toBe('all');
  });

  it('reads the first key of a selection', () => {
    expect(chooseFirst(options, new Set(['new']), 'all')).toBe('new');
    expect(chooseFirst(options, new Set(), 'all')).toBe('all');
  });
});
