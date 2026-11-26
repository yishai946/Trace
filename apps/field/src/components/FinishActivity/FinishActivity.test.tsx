import { fireEvent, render, screen } from '@testing-library/react';
import type { OwnParticipation } from '@trace/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinishActivity } from '.';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const finish = vi.hoisted(() => vi.fn());
vi.mock('../../mission/useFinishActivity', () => ({
  useFinishActivity: () => ({ finish, pending: false, error: null }),
}));
vi.mock('../../mission/queries', () => ({
  useMission: () => ({ data: { rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] } } }),
}));
vi.mock('../../location/useCurrentFix', () => ({
  useCurrentFix: () => ({ state: 'ready', fix: { position: [35.13, 31.78], accuracy: 5, at: 0 } }),
}));

const participation = (status: OwnParticipation['status']): OwnParticipation => ({
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status,
  polygonId: null,
  taskStatus: null,
});
const renderIt = () =>
  render(
    <TestProviders>
      <FinishActivity />
    </TestProviders>,
  );

afterEach(() => {
  finish.mockClear();
  useSession.setState({ participation: null });
});

describe('FinishActivity (UC-F15)', () => {
  it.each(['available', 'assigned'] as const)('lets a %s searcher finish the activity after confirming', (status) => {
    useSession.setState({ participation: participation(status) });
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'סיימתי פעילות…' }));
    fireEvent.click(screen.getByRole('button', { name: 'סיים פעילות' }));
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('shows nothing once the activity ended', () => {
    useSession.setState({ participation: participation('ended') });
    renderIt();
    expect(screen.queryByRole('button', { name: 'סיימתי פעילות…' })).not.toBeInTheDocument();
  });
});
