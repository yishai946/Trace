import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHONE_QUERY, usePhoneLayout } from '.';

function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return matches;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  const matchMedia = vi.fn(() => media);
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    set(value: boolean) {
      matches = value;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('usePhoneLayout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is false without matchMedia, as in tests and old browsers', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => usePhoneLayout());
    expect(result.current).toBe(false);
  });

  it('follows the phone width query as the window changes', () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => usePhoneLayout());
    expect(media.matchMedia).toHaveBeenCalledWith(PHONE_QUERY);
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);
  });
});
