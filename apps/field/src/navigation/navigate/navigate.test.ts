import { describe, expect, it, vi } from 'vitest';
import { goBackOr, openScreen } from '.';

const fakeRouter = (canGoBack: boolean) => ({
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  canGoBack: vi.fn(() => canGoBack),
});

describe('openScreen', () => {
  it('opens a screen once, however often it is tapped', () => {
    const router = fakeRouter(true);
    openScreen(router, '/report');
    openScreen(router, '/report');
    // `dangerouslySingular` keeps a single /report in the stack, so a double tap does not stack it twice.
    expect(router.push).toHaveBeenCalledWith('/report', { dangerouslySingular: true });
  });
});

describe('goBackOr', () => {
  it('goes back when there is a screen to go back to', () => {
    const router = fakeRouter(true);
    goBackOr(router, '/map');
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces with the fallback when the screen was opened directly, e.g. from a link', () => {
    const router = fakeRouter(false);
    goBackOr(router, '/map');
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/map');
  });
});
