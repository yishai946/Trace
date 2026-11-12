import { themes } from '@trace/design';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEnded } from '.';
import { usePreferences } from '../../state/preferences';
import { TestProviders } from '../../test/providers';

afterEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('ActivityEnded', () => {
  it('tells a removed searcher that tracking stopped and offers to join again', () => {
    const onJoinAgain = vi.fn();
    render(<ActivityEnded mission={undefined} removed onJoinAgain={onJoinAgain} onOpenMyMissions={() => {}} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByRole('heading', { name: 'הוסרת מהפעילות' })).toBeInTheDocument();
    expect(screen.getByText(/המנהל הסיר אותך מהמסע/)).toBeInTheDocument();
    expect(screen.getByText('נפסק')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הצטרף שוב' }));
    expect(onJoinAgain).toHaveBeenCalled();
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
