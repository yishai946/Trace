import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JoinLandingPage } from '.';

describe('JoinLandingPage', () => {
  it('shows the code and a button that opens it in the Field app', () => {
    render(<JoinLandingPage code="K7-4Q2" />);
    expect(screen.getByText('K7-4Q2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'פתיחה באפליקציה' })).toHaveAttribute('href', 'trace-field://j/K7-4Q2');
  });

  it('explains how to install the app and join with the code', () => {
    render(<JoinLandingPage code="K7-4Q2" />);
    expect(screen.getByRole('heading', { level: 1, name: 'הצטרפות למסע חיפוש' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
