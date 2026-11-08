import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '.';

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText(/אימייל/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/סיסמה/), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'כניסה' }));
};

const stubPhone = (phone: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: phone, addEventListener() {}, removeEventListener() {} })),
  );

describe.each([
  ['desktop', false],
  ['phone', true],
])('LoginPage on the %s', (_layout, phone) => {
  beforeEach(() => stubPhone(phone));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('signs in with email and password, then reloads the session (UC-C01)', async () => {
    const fetch = respond(200, { token: 't', user: { id: 'u1' } });
    const queryClient = renderPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fill(' commander@trace.test ', 'secret-password');

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['session'] }));
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/sign-in/email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'commander@trace.test', password: 'secret-password' }),
      }),
    );
  });

  it('shows an error for wrong credentials and stays on the form', async () => {
    respond(401, { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' });
    renderPage();

    fill('commander@trace.test', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('האימייל או הסיסמה שגויים');
    expect(screen.getByLabelText(/אימייל/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('lets the commander try again after a failed attempt', async () => {
    const fetch = respond(401, { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' });
    renderPage();

    fill('commander@trace.test', 'wrong');
    await screen.findByRole('alert');
    fill('commander@trace.test', 'right');

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('blocks sign-in without an internet connection', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetch = vi.spyOn(globalThis, 'fetch');
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט');
    expect(screen.getByRole('button', { name: 'כניסה' })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  if (phone) {
    it('shows the brand above a sheet that holds only the sign-in form (Cm01)', () => {
      respond(200, {});
      renderPage();

      const main = screen.getByRole('main', { name: 'כניסת מנהל' });
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(within(main).getByRole('heading', { level: 1, name: 'כניסת מנהל' })).toBeTruthy();
      expect(within(main).getByLabelText(/אימייל/)).toBeTruthy();
      expect(within(main).getByLabelText(/סיסמה/)).toBeTruthy();
      expect(screen.getByText('TRACE Command')).toBeTruthy();
      expect(screen.getByText('ניהול מסע חיפוש והצלה')).toBeTruthy();
    });

    it('ties the error banner to both fields', async () => {
      respond(401, { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' });
      renderPage();

      fill('commander@trace.test', 'wrong');

      expect(await screen.findByRole('alert')).toHaveAttribute('id', 'login-error');
      expect(screen.getByLabelText(/אימייל/)).toHaveAttribute('aria-describedby', 'login-error');
      expect(screen.getByLabelText(/סיסמה/)).toHaveAttribute('aria-describedby', 'login-error');
    });

    it('reads "נכנס…" and disables the button while signing in', async () => {
      vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
      renderPage();

      fill('commander@trace.test', 'secret-password');

      expect(await screen.findByRole('button', { name: 'נכנס…' })).toBeDisabled();
    });
  }
});
