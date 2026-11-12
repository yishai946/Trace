import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({
  getRandomValues: <T extends Uint8Array | Uint16Array>(array: T): T => globalThis.crypto.getRandomValues(array),
}));

// Each test gets a fresh module, so the last-time state of an earlier test does not leak in.
const load = async () => {
  vi.resetModules();
  return (await import('.')).uuidv7;
};

afterEach(() => vi.useRealTimers());

describe('uuidv7', () => {
  it('has the version 7 and RFC 9562 variant bits', async () => {
    const uuidv7 = await load();
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('starts with the current time in milliseconds', async () => {
    const uuidv7 = await load();
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 3, 10, 1, 2, 3));
    const hex = uuidv7().replace(/-/g, '').slice(0, 12);
    expect(parseInt(hex, 16)).toBe(Date.UTC(2026, 9, 3, 10, 1, 2, 3));
  });

  it('sorts in creation order within one millisecond and across milliseconds, without repeats', async () => {
    const uuidv7 = await load();
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const ids: string[] = [];
    for (let i = 0; i < 1000; i++) ids.push(uuidv7());
    vi.setSystemTime(1_800_000_000_005);
    for (let i = 0; i < 1000; i++) ids.push(uuidv7());
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });

  it('keeps rising when the clock goes back', async () => {
    const uuidv7 = await load();
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_100);
    const first = uuidv7();
    vi.setSystemTime(1_800_000_000_000);
    expect(uuidv7() > first).toBe(true);
  });
});
