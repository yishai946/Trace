import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SosHoldButton } from '.';
import { SOS_HOLD_MS } from '../../sos/useHoldToActivate';
import { TestProviders } from '../../test/providers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const button = () => screen.getByRole('button', { name: /הפעל SOS/ });
const progressArc = () => screen.getByTestId('sos-progress');

/** react-native-web's Pressable reports the press 50 ms after the touch. */
const press = () => {
  fireEvent.mouseDown(button());
  act(() => vi.advanceTimersByTime(60));
};

function setup(onActivate = vi.fn()) {
  render(
    <TestProviders>
      <SosHoldButton sending={false} onActivate={onActivate} />
    </TestProviders>,
  );
  return onActivate;
}

describe('SosHoldButton', () => {
  it('draws the kept part of the hold on the ring and clears it on release', () => {
    setup();
    expect(progressArc()).toHaveAttribute('stroke-dashoffset', progressArc().getAttribute('stroke-dasharray'));
    press();
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS / 2));
    const length = Number(progressArc().getAttribute('stroke-dasharray'));
    expect(Math.abs(Number(progressArc().getAttribute('stroke-dashoffset')) - length / 2)).toBeLessThan(length / 10);
    fireEvent.mouseUp(button());
    expect(Number(progressArc().getAttribute('stroke-dashoffset'))).toBe(length);
  });

  it('announces the countdown in a polite live region', () => {
    setup();
    press();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('3');
    act(() => vi.advanceTimersByTime(1000));
    expect(status).toHaveTextContent('2');
  });

  it('keeps the hidden countdown from catching the pointer over the button', () => {
    setup();
    press();
    expect(screen.getByRole('status')).toHaveStyle({ pointerEvents: 'none' });
  });

  it('cancels the hold when the pointer leaves the button', () => {
    const onActivate = setup();
    fireEvent.pointerEnter(button(), { pointerType: 'mouse' });
    press();
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.pointerLeave(button(), { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS));
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.getByText(/^החזק/)).toBeInTheDocument();
  });
});
