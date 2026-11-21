import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLeaveWhenRemoved } from '.';
import { useSession } from '../../state/session';
import { routes } from '../routes';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ navigate }) }));

beforeEach(() => {
  navigate.mockClear();
  useSession.setState(useSession.getInitialState());
});

describe('useLeaveWhenRemoved', () => {
  it('stays put until the commander ends the participation, then opens the map', () => {
    renderHook(() => useLeaveWhenRemoved());
    expect(navigate).not.toHaveBeenCalled();
    act(() => useSession.setState({ assignmentNotice: { kind: 'ended', polygonId: null } }));
    expect(navigate).toHaveBeenCalledWith(routes.map);
  });
});
