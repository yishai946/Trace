import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MorePage, type MorePageProps } from '.';
import { ThemeProvider } from '../../theme/theme';

const user = { id: 'u1', name: 'ישי ביטון', email: 'yishai@trace.test', role: 'commander' as const };

function renderPage(overrides: Partial<MorePageProps> = {}) {
  const props: MorePageProps = {
    user,
    canSignOut: true,
    signingOut: false,
    signOutFailed: false,
    onSignOut: vi.fn(),
    connection: { state: 'up', label: 'מחובר', detail: 'החיבור לשרת תקין.' },
    onShowAllMissions: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider>
      <MorePage {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('MorePage', () => {
  afterEach(() => localStorage.clear());

  it('shows the title, the account section and the user details', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'עוד' })).toBeTruthy();
    expect(screen.getByText('חשבון')).toBeTruthy();
    expect(screen.getByText('ישי ביטון')).toBeTruthy();
    expect(screen.getByText('מנהל מסע')).toBeTruthy();
    expect(screen.getByText('yishai@trace.test')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('יב')).toBeTruthy();
  });

  it('shows the connection status', () => {
    renderPage({ connection: { state: 'down', label: 'מנותק', detail: 'אין חיבור.' } });
    expect(screen.getByRole('status')).toHaveTextContent('מנותק');
  });

  it('chooses the theme in a row', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ערכת צבעים/ }));
    fireEvent.click(screen.getByRole('option', { name: 'יום' }));
    expect(localStorage.getItem('trace.theme')).toBe('day');
  });

  it('opens all missions', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'כל המסעות' }));
    expect(props.onShowAllMissions).toHaveBeenCalledOnce();
  });

  it('signs out', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'יציאה' }));
    expect(props.onSignOut).toHaveBeenCalledOnce();
  });

  it('blocks sign-out offline and says why', () => {
    renderPage({ canSignOut: false });
    expect(screen.getByRole('button', { name: 'יציאה' })).toBeDisabled();
    expect(screen.getByText('אפשר לצאת כשהחיבור יחזור.')).toBeTruthy();
  });

  it('reports a failed sign-out', () => {
    renderPage({ signOutFailed: true });
    expect(screen.getByRole('alert')).toHaveTextContent('היציאה נכשלה. נסו שוב.');
  });

  it('shows signing out and blocks a second press', () => {
    renderPage({ signingOut: true });
    expect(screen.getByRole('button', { name: 'יוצא…' })).toBeDisabled();
  });

  it('leaves out the in-mission rows that have no screen yet', () => {
    renderPage();
    expect(screen.queryByText('במסע')).toBeNull();
    expect(screen.queryByRole('button', { name: /מסע שהסתיים/ })).toBeNull();
  });

  it('keeps long names and emails inside their row', () => {
    renderPage({ user: { ...user, name: 'שם ארוך מאוד '.repeat(10), email: `${'a'.repeat(80)}@trace.test` } });
    expect(screen.getByText(`${'a'.repeat(80)}@trace.test`)).toBeTruthy();
  });
});
