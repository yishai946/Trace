import { describe, expect, it } from 'vitest';
import { actorOf, searcherOf, type Actor } from './auth.plugin';

const commander: Actor = { role: 'commander', userId: 'u1' };

describe('actorOf', () => {
  it('returns the signed-in actor', () => {
    expect(actorOf({ actor: commander })).toBe(commander);
  });

  it('answers 401 without an actor', () => {
    expect(() => actorOf({ actor: null })).toThrow(
      expect.objectContaining({ statusCode: 401, code: 'UNAUTHENTICATED' }),
    );
  });
});

describe('searcherOf', () => {
  it('returns a searcher who has a profile', () => {
    const actor: Actor = { role: 'searcher', userId: 'u1', searcherId: 's1' };
    expect(searcherOf({ actor })).toEqual({ role: 'searcher', userId: 'u1', searcherId: 's1' });
  });

  it('refuses a commander with 403', () => {
    expect(() => searcherOf({ actor: commander })).toThrow(
      expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' }),
    );
  });

  it('refuses a searcher without a profile with 403', () => {
    const actor: Actor = { role: 'searcher', userId: 'u1', searcherId: null };
    expect(() => searcherOf({ actor })).toThrow(expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' }));
  });

  it('answers 401 without an actor', () => {
    expect(() => searcherOf({ actor: null })).toThrow(
      expect.objectContaining({ statusCode: 401, code: 'UNAUTHENTICATED' }),
    );
  });
});
