import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertBanners } from '.';
import { useAlerts } from '../../alerts';
import { TestProviders } from '../../test/providers';

const push = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  useAlerts.setState(useAlerts.getInitialState());
});

const show = () =>
  render(
    <TestProviders>
      <AlertBanners />
    </TestProviders>,
  );

describe('AlertBanners', () => {
  it('shows nothing when there is no alert', () => {
    show();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces each alert with its title and text', () => {
    useAlerts
      .getState()
      .raise({ id: 'a', kind: 'details', title: 'פרטי הנעדר עודכנו', text: 'עודכן: גיל', href: null });
    show();
    expect(screen.getByRole('alert').textContent).toContain('פרטי הנעדר עודכנו');
    expect(screen.getByRole('alert').textContent).toContain('עודכן: גיל');
  });

  it('opens the screen of an alert and removes it', () => {
    useAlerts.getState().raise({ id: 'a', kind: 'sos', title: 'SOS', text: 'x', href: '/sos' });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'פתח' }));
    expect(push).toHaveBeenCalledWith('/sos', { dangerouslySingular: true });
    expect(useAlerts.getState().alerts).toEqual([]);
  });

  it('offers no open button when the alert has no screen, and dismisses it', () => {
    useAlerts.getState().raise({ id: 'b', kind: 'details', title: 'פרטי הנעדר עודכנו', text: 'x', href: null });
    show();
    expect(screen.queryByRole('button', { name: 'פתח' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
