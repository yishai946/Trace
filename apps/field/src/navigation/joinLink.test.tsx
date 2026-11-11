import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JoinLinkScreen from '../app/j/[code]';
import { useSession } from '../state/session';

const link = vi.hoisted(() => ({ code: '' }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ code: link.code }),
  Redirect: ({ href }: { href: string }) => <p>{`redirect ${href}`}</p>,
}));

describe('the join link route, /j/<code>', () => {
  beforeEach(() => useSession.setState(useSession.getInitialState()));

  it('keeps the code for the join screen and goes through the start gate', async () => {
    link.code = 'k7-4q2';
    render(<JoinLinkScreen />);

    expect(await screen.findByText('redirect /')).toBeInTheDocument();
    expect(useSession.getState().pendingJoinCode).toBe('K7-4Q2');
  });

  it('drops a link whose code is malformed', async () => {
    useSession.setState({ pendingJoinCode: 'K7-4Q2' });
    link.code = 'nonsense';
    render(<JoinLinkScreen />);

    expect(await screen.findByText('redirect /')).toBeInTheDocument();
    expect(useSession.getState().pendingJoinCode).toBeNull();
  });
});
