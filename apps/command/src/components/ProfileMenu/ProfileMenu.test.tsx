import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileMenu, initials, type ProfileMenuProps } from '.';
import { ThemeProvider } from '../../theme/theme';

const user = { id: 'u1', name: 'ישי ביטון', email: 'yishai@trace.test', role: 'commander' as const };

function renderMenu(overrides: Partial<ProfileMenuProps> = {}) {
  const props: ProfileMenuProps = {
    user,
    canSignOut: true,
    signingOut: false,
    signOutFailed: false,
    onSignOut: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider>
      <ProfileMenu {...props} />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /פרופיל: ישי ביטון/ }));
  return props;
}

describe('ProfileMenu', () => {
  afterEach(() => localStorage.clear());

  it('shows the avatar initials and opens the user details', () => {
    renderMenu();
    expect(screen.getAllByText('יב').length).toBeGreaterThan(0);
    expect(screen.getByText('מנהל מסע')).toBeTruthy();
    expect(screen.getByText('yishai@trace.test')).toBeTruthy();
  });

  it('signs out from the menu', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'יציאה' }));
    expect(props.onSignOut).toHaveBeenCalledOnce();
  });

  it('blocks sign-out without a connection and reports a failed one', () => {
    renderMenu({ canSignOut: false, signOutFailed: true });
    expect(screen.getByRole('button', { name: 'יציאה' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('היציאה נכשלה');
  });

  it('chooses day, night or the device theme', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /ערכת צבעים/ }));
    fireEvent.click(screen.getByRole('option', { name: 'יום' }));
    expect(document.documentElement.dataset.theme).toBe('day');
    expect(localStorage.getItem('trace.theme')).toBe('day');
  });
});

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('ישי ביטון')).toBe('יב');
    expect(initials('  מנהל  ')).toBe('מ');
    expect(initials('דנה בת שבע כהן')).toBe('דב');
  });
});
