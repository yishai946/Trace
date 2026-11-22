import { act, renderHook } from '@testing-library/react';
import type { NotificationResponse } from 'expo-notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationTaps } from '.';
import { routes } from '../../navigation/routes';
import { useSession } from '../../state/session';

const MISSION = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

const expo = vi.hoisted(() => ({
  listeners: [] as ((response: NotificationResponse) => void)[],
  last: null as NotificationResponse | null,
  cleared: 0,
}));
vi.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (listener: (response: NotificationResponse) => void) => {
    expo.listeners.push(listener);
    return { remove: () => expo.listeners.splice(expo.listeners.indexOf(listener), 1) };
  },
  getLastNotificationResponse: () => expo.last,
  clearLastNotificationResponse: () => {
    expo.cleared++;
    expo.last = null;
  },
}));

const push = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));

const response = (data: unknown) => ({ notification: { request: { content: { data } } } }) as NotificationResponse;
const tap = (data: unknown) => act(() => expo.listeners.forEach((listener) => listener(response(data))));
const open = { dangerouslySingular: true };

beforeEach(() => {
  push.mockReset();
  expo.listeners.length = 0;
  expo.last = null;
  expo.cleared = 0;
  useSession.setState({ token: 'tok', missionId: MISSION });
});
afterEach(() => useSession.setState({ token: null, missionId: null }));

describe('useNotificationTaps', () => {
  it.each([
    ['sos', routes.sos],
    ['messages', routes.messages],
    ['map', routes.map],
  ] as const)('opens %s when its notification is tapped', (screen, href) => {
    renderHook(() => useNotificationTaps());
    tap({ missionId: MISSION, screen });
    expect(push).toHaveBeenCalledWith(href, open);
  });

  it('opens the screen of a notification that started the app', () => {
    expo.last = response({ missionId: MISSION, screen: 'sos' });
    renderHook(() => useNotificationTaps());
    expect(push).toHaveBeenCalledWith(routes.sos, open);
    expect(expo.cleared).toBe(1);
  });

  it('keeps a tap until the mission is open, then opens it once', () => {
    useSession.setState({ missionId: null });
    renderHook(() => useNotificationTaps());
    tap({ missionId: MISSION, screen: 'messages' });
    expect(push).not.toHaveBeenCalled();
    act(() => useSession.setState({ missionId: MISSION }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(routes.messages, open);
    act(() => useSession.setState({ missionId: OTHER }));
    act(() => useSession.setState({ missionId: MISSION }));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('does not open a notification of another mission than the searcher is in', () => {
    renderHook(() => useNotificationTaps());
    tap({ missionId: OTHER, screen: 'sos' });
    expect(push).not.toHaveBeenCalled();
  });

  it('drops a tap of another mission when the searcher joins the mission it names later', () => {
    useSession.setState({ missionId: null });
    renderHook(() => useNotificationTaps());
    tap({ missionId: OTHER, screen: 'sos' });
    act(() => useSession.setState({ missionId: MISSION }));
    act(() => useSession.setState({ missionId: OTHER }));
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores data it does not know', () => {
    renderHook(() => useNotificationTaps());
    tap({ screen: 'nowhere' });
    expect(push).not.toHaveBeenCalled();
  });
});
