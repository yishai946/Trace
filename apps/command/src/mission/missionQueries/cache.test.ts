import { describe, expect, it } from 'vitest';
import { addOnce, patchById, prepend, removeById, replaceById, upsertById } from './cache';

const a = { id: 'a', n: 1 };
const b = { id: 'b', n: 2 };

describe('cached list updates', () => {
  it('leaves a list that is not loaded unloaded', () => {
    for (const update of [replaceById(a), upsertById(a), addOnce(a), removeById<typeof a>('a')]) {
      expect(update(undefined)).toBeUndefined();
    }
  });

  it('replaces and patches only the item with the id', () => {
    expect(replaceById({ id: 'a', n: 9 })([a, b])).toEqual([{ id: 'a', n: 9 }, b]);
    expect(replaceById({ id: 'c', n: 9 })([a, b])).toEqual([a, b]);
    expect(patchById<typeof a>('b', (item) => ({ ...item, n: 0 }))([a, b])).toEqual([a, { id: 'b', n: 0 }]);
  });

  it('upserts: replaces a known item, adds an unknown one where asked', () => {
    expect(upsertById({ id: 'a', n: 9 })([a, b])).toEqual([{ id: 'a', n: 9 }, b]);
    expect(upsertById(b)([a])).toEqual([a, b]);
    expect(upsertById(b, prepend)([a])).toEqual([b, a]);
  });

  it('adds once and removes by id', () => {
    expect(addOnce(b, prepend)([a])).toEqual([b, a]);
    expect(addOnce({ id: 'a', n: 9 })([a])).toEqual([a]);
    expect(removeById<typeof a>('a')([a, b])).toEqual([b]);
  });
});
