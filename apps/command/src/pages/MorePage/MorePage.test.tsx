import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MorePage, type MorePageProps } from '.';
import { ThemeProvider } from '../../theme/theme';

const user = { id: 'u1', name: 'ישי ביטון', email: 'yishai@trace.test', role: 'commander' as const };

function renderPage(overrides: Partial<MorePageProps> = {}) {
  const props: MorePageProps = {
    user,
    onMissionDetails: vi.fn(),
    onAllMissions: vi.fn(),
    canSignOut: true,
    signingOut: false,
    signOutFailed: false,
    onSignOut: vi.fn(),
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

  it('shows the account details as in the profile menu', () => {
    renderPage();
    expect(screen.getByText('ישי ביטון')).toBeTruthy();
    expect(screen.getByText('מנהל מסע')).toBeTruthy();
    expect(screen.getByText('yishai@trace.test')).toBeTruthy();
  });

  it('opens the mission details and the full mission list', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'פרטי מסע וקוד הצטרפות' }));
    expect(props.onMissionDetails).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'כל המסעות' }));
    expect(props.onAllMissions).toHaveBeenCalledOnce();
  });

  it('chooses the theme', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ערכת צבעים/ }));
    fireEvent.click(screen.getByRole('option', { name: 'לילה' }));
    expect(document.documentElement.dataset.theme).toBe('night');
  });

  it('signs out', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'יציאה' }));
    expect(props.onSignOut).toHaveBeenCalledOnce();
  });

  it('explains why sign-out is blocked offline', () => {
    renderPage({ canSignOut: false });
    expect(screen.getByRole('button', { name: 'יציאה' })).toBeDisabled();
    expect(screen.getByText('אפשר לצאת כשהחיבור יחזור.')).toBeTruthy();
  });
});
