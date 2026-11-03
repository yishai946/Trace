import { describe, expect, it } from 'vitest';
import { generateJoinCode, isJoinCode, joinCodeFromLink, joinLink, type RandomInt } from '.';

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

describe('joinLink', () => {
  it('builds the link under the base, with or without a trailing slash', () => {
    expect(joinLink('https://trace.app', 'K7-4Q2')).toBe('https://trace.app/j/K7-4Q2');
    expect(joinLink('https://trace.app/', 'K7-4Q2')).toBe('https://trace.app/j/K7-4Q2');
    expect(joinLink('trace-field://', 'K7-4Q2')).toBe('trace-field://j/K7-4Q2');
  });

  it('round-trips through joinCodeFromLink', () => {
    expect(joinCodeFromLink(joinLink('https://trace.app', 'K7-4Q2'))).toBe('K7-4Q2');
    expect(joinCodeFromLink(joinLink('trace-field://', 'K7-4Q2'))).toBe('K7-4Q2');
  });
});

describe('joinCodeFromLink', () => {
  it('accepts a bare code in any case', () => {
    expect(joinCodeFromLink(' k7-4q2 ')).toBe('K7-4Q2');
  });

  it('rejects links that are not join links and malformed codes', () => {
    expect(joinCodeFromLink('https://trace.app/x/K7-4Q2')).toBeNull();
    expect(joinCodeFromLink('https://trace.app/j/K7-4Q')).toBeNull();
    expect(joinCodeFromLink('hello')).toBeNull();
  });
});
