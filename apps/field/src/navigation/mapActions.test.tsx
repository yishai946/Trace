import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapScreen from '../app/(mission)/map';
import { useSession } from '../state/session';
import { TestProviders } from '../test/providers';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => router }));
vi.mock('../components/MissionMap', () => ({ MissionMap: () => <div role="img" aria-label="מפת המסע" /> }));

beforeEach(() => {
  router.push.mockClear();
  useSession.setState({
    ...useSession.getInitialState(),
    restored: true,
    missionId: '00000000-0000-4000-8000-000000000001',
    participation: {
      id: '00000000-0000-4000-8000-000000000002',
      callsign: 7,
      status: 'assigned',
      polygonId: '00000000-0000-4000-8000-0000000000a1',
      taskStatus: 'ready',
    },
  });
});

describe('the map sheet actions', () => {
  it('opens the sighting form with "תצפית"', () => {
    render(<MapScreen />, { wrapper: TestProviders });
    fireEvent.click(screen.getByRole('button', { name: 'תצפית' }));
    expect(router.push).toHaveBeenCalledWith('/sighting', { dangerouslySingular: true });
  });
});
