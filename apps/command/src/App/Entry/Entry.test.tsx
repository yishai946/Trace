import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Entry } from '.';

vi.mock('../Launch', () => ({ Launch: () => <p>הקונסולה</p> }));
vi.mock('../../pages/JoinLandingPage', () => ({
  JoinLandingPage: ({ code }: { code: string }) => <p>נחיתה {code}</p>,
}));

describe('Entry', () => {
  afterEach(() => window.history.pushState({}, '', '/'));

  it('shows the join page, not the console, at a join link', () => {
    window.history.pushState({}, '', '/j/K7-4Q2');
    render(<Entry />);
    expect(screen.getByText('נחיתה K7-4Q2')).toBeInTheDocument();
    expect(screen.queryByText('הקונסולה')).not.toBeInTheDocument();
  });

  it('shows the console at the root and at an address that is not a join link', () => {
    window.history.pushState({}, '', '/');
    const view = render(<Entry />);
    expect(screen.getByText('הקונסולה')).toBeInTheDocument();
    view.unmount();
    window.history.pushState({}, '', '/j/not-a-code');
    render(<Entry />);
    expect(screen.getByText('הקונסולה')).toBeInTheDocument();
  });
});
