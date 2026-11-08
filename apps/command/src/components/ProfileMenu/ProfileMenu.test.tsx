import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHONE_QUERY } from '../../hooks/usePhoneLayout';
import { ProfileMenu, initials, type ProfileMenuProps } from '.';
import { ThemeProvider } from '../../theme/theme';

const user = { id: 'u1', name: 'ישי ביטון', email: 'yishai@trace.test', role: 'commander' as const };

function stubPhone(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone && query === PHONE_QUERY,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

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
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('opens as a popover on desktop', () => {
    renderMenu();
    expect(screen.getByRole('dialog', { name: 'פרופיל' })).toHaveAttribute('data-presentation', 'popover');
  });

  describe('on a phone', () => {
    it('opens as a bottom sheet with the same details', () => {
      stubPhone(true);
      renderMenu();
      const dialog = screen.getByRole('dialog', { name: 'פרופיל' });
      expect(dialog).toHaveAttribute('data-presentation', 'sheet');
      expect(dialog).toHaveTextContent('ישי ביטון');
      expect(dialog).toHaveTextContent('מנהל מסע');
      expect(dialog).toHaveTextContent('yishai@trace.test');
      expect(screen.getByRole('button', { name: /ערכת צבעים/ })).toBeTruthy();
    });

    it('signs out from the sheet', () => {
      stubPhone(true);
      const props = renderMenu();
      fireEvent.click(screen.getByRole('button', { name: 'יציאה' }));
      expect(props.onSignOut).toHaveBeenCalledOnce();
    });

    it('disables sign-out offline with an explanation', () => {
      stubPhone(true);
      renderMenu({ canSignOut: false });
      expect(screen.getByRole('button', { name: 'יציאה' })).toBeDisabled();
      expect(screen.getByText('אפשר לצאת כשהחיבור יחזור.')).toBeTruthy();
    });

    it('reports a failed sign-out', () => {
      stubPhone(true);
      renderMenu({ signOutFailed: true });
      expect(screen.getByRole('alert')).toHaveTextContent('היציאה נכשלה. נסו שוב.');
    });

    it('shows signing out and blocks a second press', () => {
      stubPhone(true);
      renderMenu({ signingOut: true });
      expect(screen.getByRole('button', { name: 'יוצא…' })).toBeDisabled();
    });

    it('closes with Escape', () => {
      stubPhone(true);
      renderMenu();
      fireEvent.keyDown(screen.getByRole('dialog', { name: 'פרופיל' }), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('chooses the theme from the sheet', () => {
      stubPhone(true);
      renderMenu();
      fireEvent.click(screen.getByRole('button', { name: /ערכת צבעים/ }));
      fireEvent.click(screen.getByRole('option', { name: 'לילה' }));
      expect(localStorage.getItem('trace.theme')).toBe('night');
    });
  });

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
    expect(document.documentElement.style.colorScheme).toBe('light');
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
