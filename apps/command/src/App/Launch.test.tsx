import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Launch, SPLASH_DELAY_MS } from './Launch';

const session = vi.hoisted(() => ({ isPending: true }));
vi.mock('../auth', () => ({ useSession: () => session }));
vi.mock('.', () => ({ App: () => <p>הקונסולה</p> }));

describe('Launch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    session.isPending = true;
  });
  afterEach(() => vi.useRealTimers());

  it('shows no splash while the load is still quick', () => {
    const view = render(<Launch />);
    act(() => vi.advanceTimersByTime(SPLASH_DELAY_MS - 50));
    session.isPending = false;
    view.rerender(<Launch />);
    act(() => vi.advanceTimersByTime(SPLASH_DELAY_MS * 2));
    expect(screen.queryByRole('img', { name: 'TRACE' })).not.toBeInTheDocument();
    expect(screen.getByText('הקונסולה')).toBeInTheDocument();
  });

  it('shows no splash when there is nothing to load', () => {
    session.isPending = false;
    render(<Launch />);
    act(() => vi.advanceTimersByTime(SPLASH_DELAY_MS * 2));
    expect(screen.queryByRole('img', { name: 'TRACE' })).not.toBeInTheDocument();
  });

  it('shows the splash when loading takes longer than the delay', () => {
    render(<Launch />);
    act(() => vi.advanceTimersByTime(SPLASH_DELAY_MS + 50));
    expect(screen.getByRole('img', { name: 'TRACE' })).toBeInTheDocument();
  });
});
