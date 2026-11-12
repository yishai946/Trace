import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocationTracking, type LocationTracker } from '.';
import { useSession } from '../state/session';

vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
}));
vi.mock('expo-task-manager', () => ({ defineTask: vi.fn() }));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  startLocationUpdatesAsync: vi.fn(),
  stopLocationUpdatesAsync: vi.fn(),
  hasStartedLocationUpdatesAsync: vi.fn(),
}));

const fakeTracker = () => ({ start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) });

describe('useLocationTracking', () => {
  beforeEach(() => useSession.setState(useSession.getInitialState()));

  it('starts the tracker while the session tracks, and stops it after', () => {
    const tracker = fakeTracker();
    const { rerender } = renderHook(() => useLocationTracking(tracker satisfies LocationTracker));
    expect(tracker.stop).toHaveBeenCalledTimes(1);
    expect(tracker.start).not.toHaveBeenCalled();

    useSession.setState({ tracking: true });
    rerender();
    expect(tracker.start).toHaveBeenCalledTimes(1);

    useSession.setState({ tracking: false });
    rerender();
    expect(tracker.stop).toHaveBeenCalledTimes(2);
  });
});
