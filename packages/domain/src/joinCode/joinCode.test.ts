import { describe, expect, it } from 'vitest';
import { generateJoinCode, isJoinCode, type RandomInt } from '.';

const mathRandomInt: RandomInt = (max) => Math.floor(Math.random() * max);

describe('generateJoinCode', () => {
  it('produces two groups of 2 and 3 characters', () => {
    for (let i = 0; i < 50; i++) expect(isJoinCode(generateJoinCode(mathRandomInt))).toBe(true);
  });

  it('uses the injected random source', () => {
    expect(generateJoinCode(() => 0)).toBe('AA-AAA');
  });

  it('never uses characters that are easy to confuse', () => {
    const codes = Array.from({ length: 200 }, () => generateJoinCode(mathRandomInt)).join('');
    expect(codes).not.toMatch(/[01OIL]/);
  });

  it('rejects malformed codes', () => {
    expect(isJoinCode('K7-4Q2')).toBe(true);
    expect(isJoinCode('K74Q2')).toBe(false);
    expect(isJoinCode('O7-4Q2')).toBe(false);
  });
});
