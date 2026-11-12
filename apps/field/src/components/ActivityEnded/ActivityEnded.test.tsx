import { themes } from '@trace/design';
import type { Mission } from '@trace/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEnded } from '.';
import { usePreferences } from '../../state/preferences';
import { TestProviders } from '../../test/providers';

afterEach(() => usePreferences.setState(usePreferences.getInitialState()));

const mission: Mission = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'מסע 0412',
  status: 'active',
  joinCode: 'K7-4Q2',
  missingPerson: {
    name: 'נועם אברהם',
    age: 74,
    disappearedAt: null,
    description: null,
    additionalInfo: null,
    photoUrl: null,
  },
  rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
  lkp: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
};

describe('ActivityEnded', () => {
  it('tells a removed searcher that tracking stopped and offers to join again', () => {
    const onJoinAgain = vi.fn();
    render(<ActivityEnded mission={mission} removed onJoinAgain={onJoinAgain} onOpenMyMissions={() => {}} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByRole('heading', { name: 'הוסרת מהפעילות' })).toBeInTheDocument();
    expect(screen.getByText(/המנהל הסיר אותך מהמסע/)).toBeInTheDocument();
    expect(screen.getByText('נפסק')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הצטרף שוב' }));
    expect(onJoinAgain).toHaveBeenCalled();
    expect(screen.getByText('מסע 0412, נועם אברהם')).toBeInTheDocument();
  });

  it('does not offer to join a mission that is no longer active', () => {
    render(
      <ActivityEnded
        mission={{ ...mission, status: 'paused' }}
        removed
        onJoinAgain={() => {}}
        onOpenMyMissions={() => {}}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByRole('button', { name: 'הצטרף שוב' })).toBeNull();
    expect(screen.getByText('המנהל הסיר אותך מהמסע. ההשתתפות נשמרה בהיסטוריה.')).toBeInTheDocument();
  });

  it.each(['night', 'day'] as const)('works in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    render(<ActivityEnded mission={undefined} removed={false} onJoinAgain={() => {}} onOpenMyMissions={() => {}} />, {
      wrapper: TestProviders,
    });
    expect(screen.getByRole('heading', { name: 'הפעילות הסתיימה' })).toBeInTheDocument();
    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: themes[id].color.surface });
  });
});
