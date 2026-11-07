import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPLASH } from '@trace/design';
import { Splash } from '.';

const WALKED_MS = 10_000;

/** Each timer is set only after the previous one re-rendered the splash (walk, opening, closing), so run them in turn. */
function letTimeRun() {
  for (let phase = 0; phase < 4; phase += 1) act(() => vi.advanceTimersByTime(WALKED_MS));
}

describe('Splash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is named TRACE for screen readers', () => {
    render(<Splash onDone={() => {}} />);
    expect(screen.getByRole('img', { name: 'TRACE' })).toBeInTheDocument();
  });

  it('keeps walking while the console is still loading', () => {
    render(<Splash ready={false} onDone={() => {}} />);
    act(() => vi.advanceTimersByTime(WALKED_MS));
    expect(screen.queryByTestId('grow')).not.toBeInTheDocument();
  });

  it('opens the screen once the walk is over and the console is ready, then calls onDone once', () => {
    const onDone = vi.fn();
    render(<Splash ready onDone={onDone} />);
    expect(screen.queryByTestId('grow')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(SPLASH.openMs * 3));
    expect(screen.getByTestId('grow')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(SPLASH.openMs));
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.transitionEnd(screen.getByRole('img', { name: 'TRACE' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    letTimeRun();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('still finishes when the fade never reports its end (a throttled background tab)', () => {
    const onDone = vi.fn();
    render(<Splash ready onDone={onDone} />);
    letTimeRun();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('only fades, without the growing step, when the visitor prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query }));
    const onDone = vi.fn();
    render(<Splash onDone={onDone} />);
    letTimeRun();
    expect(screen.queryByTestId('grow')).not.toBeInTheDocument();

    fireEvent.transitionEnd(screen.getByRole('img', { name: 'TRACE' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
