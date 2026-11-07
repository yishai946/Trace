import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Splash } from '.';
import { ThemeProvider } from '../../theme';

describe('Splash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is named TRACE for screen readers', () => {
    render(
      <ThemeProvider>
        <Splash onDone={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText('TRACE')).toBeInTheDocument();
  });

  it('calls onDone once, after the walk and the opening', async () => {
    const onDone = vi.fn();
    render(
      <ThemeProvider>
        <Splash onDone={onDone} />
      </ThemeProvider>,
    );
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
