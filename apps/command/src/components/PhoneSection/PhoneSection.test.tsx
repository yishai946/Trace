import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhoneSection } from '.';

function renderSection(phoneNumber: string | null = null) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PhoneSection phoneNumber={phoneNumber} />
    </QueryClientProvider>,
  );
}

const sent = () => vi.mocked(globalThis.fetch).mock.calls.map(([, init]) => init?.body);

describe('PhoneSection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the saved number in local form', () => {
    renderSection('+972523401187');
    expect(screen.getByLabelText('מספר טלפון')).toHaveValue('052-340-1187');
  });

  it('saves a typed number and confirms', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ phoneNumber: '+972523401187' }));
    renderSection();
    fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: '0523401187' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('המספר נשמר.')).toBeInTheDocument();
    expect(sent()).toEqual([JSON.stringify({ phoneNumber: '0523401187' })]);
  });

  it('does not send a number that is not a phone number', () => {
    vi.spyOn(globalThis, 'fetch');
    renderSection();
    fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: '12ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(screen.getByText('המספר אינו תקין. למשל 052-340-1187.')).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('removes the number when the field is emptied', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ phoneNumber: null }));
    renderSection('+972523401187');
    fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('המספר נשמר.')).toBeInTheDocument();
    expect(sent()).toEqual([JSON.stringify({ phoneNumber: null })]);
  });

  it('says when the number belongs to another account', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: { code: 'PHONE_IN_USE', message: 'x' } }, { status: 409 }),
    );
    renderSection();
    fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: '0523401187' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('המספר כבר משויך לחשבון אחר.');
  });

  it('says when saving failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    renderSection();
    fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: '0523401187' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('השמירה נכשלה. נסו שוב.'));
  });
});
