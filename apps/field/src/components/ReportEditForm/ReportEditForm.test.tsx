import { themes } from '@trace/design';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportEditForm } from '.';
import { makeReport, MISSION_ID } from '../../reports/fixtures';
import { usePreferences } from '../../state/preferences';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const failure = (status: number, code: string) => json({ error: { code, message: 'x' } }, status);

const report = makeReport({ type: 'hazard', text: 'מדרון חלק' });

const setup = (props: { onDone?: () => void; onCancel?: () => void } = {}) => {
  const onDone = props.onDone ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  render(
    <TestProviders>
      <ReportEditForm report={report} onCancel={onCancel} onDone={onDone} />
    </TestProviders>,
  );
  return { onDone, onCancel };
};
const save = () => screen.getByRole('button', { name: 'שמור שינויים' });

beforeEach(() => {
  usePreferences.setState(usePreferences.getInitialState());
  useSession.setState({ token: 'tok', missionId: MISSION_ID });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null, missionId: null });
});

describe('ReportEditForm', () => {
  it('shows the report’s category and text, and says the place and photo cannot change', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'עריכת דיווח' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /מפגע/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: 'פירוט' })).toHaveValue('מדרון חלק');
    expect(screen.getByText(/המיקום והתמונה לא ניתנים לשינוי/)).toBeInTheDocument();
  });

  it('keeps save disabled until something changed', () => {
    setup();
    expect(save()).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'פירוט' }), { target: { value: 'מדרון חלק מאוד' } });
    expect(save()).toBeEnabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'פירוט' }), { target: { value: 'מדרון חלק' } });
    expect(save()).toBeDisabled();
  });

  it('sends only the changed text, trimmed, and closes when it is saved', async () => {
    const fetch = vi.fn(async () => json({ ...report, text: 'חדש' }));
    vi.stubGlobal('fetch', fetch);
    const { onDone } = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'פירוט' }), { target: { value: '  חדש ' } });
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'חדש' });
  });

  it('sends only the changed category', async () => {
    const fetch = vi.fn(async () => json({ ...report, type: 'inaccessible' }));
    vi.stubGlobal('fetch', fetch);
    const { onDone } = setup();
    fireEvent.click(screen.getByRole('radio', { name: /לא נגיש/ }));
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ type: 'inaccessible' });
  });

  it('asks for a text when it was emptied and does not send', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'פירוט' }), { target: { value: '   ' } });
    fireEvent.click(save());
    expect(screen.getByText('כתוב מה ראית.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears the empty-text message once valid text is typed', () => {
    setup();
    const field = screen.getByRole('textbox', { name: 'פירוט' });
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(save());
    expect(screen.getByText('כתוב מה ראית.')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'מדרון' } });
    expect(screen.queryByText('כתוב מה ראית.')).toBeNull();
  });

  it('says "שומר…" and disables the button while saving, so a second press sends nothing', async () => {
    let finish: (res: Response) => void = () => undefined;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)));
    vi.stubGlobal('fetch', fetch);
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'פירוט' }), { target: { value: 'חדש' } });
    fireEvent.click(save());
    const saving = await screen.findByRole('button', { name: 'שומר…' });
    expect(saving).toBeDisabled();
    fireEvent.click(saving);
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(json({ ...report, text: 'חדש' }));
  });

  it.each([
    [0, 'NETWORK_ERROR', 'אין חיבור: השינויים לא נשמרו. נסה שוב כשיש חיבור.'],
    [409, 'MISSION_ENDED', 'הפעילות הסתיימה: אי אפשר לערוך את הדיווח.'],
    [403, 'FORBIDDEN', 'אפשר לערוך רק דיווח שאתה שלחת.'],
    [404, 'NOT_FOUND', 'הדיווח כבר לא קיים.'],
    [500, 'INTERNAL_ERROR', 'לא ניתן לשמור את השינויים. נסה שוב.'],
  ])('says what went wrong on %s %s and keeps what was typed', async (status, code, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (status === 0) throw new TypeError('offline');
        return failure(status, code);
      }),
    );
    const { onDone } = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'פירוט' }), { target: { value: 'חדש' } });
    fireEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('textbox', { name: 'פירוט' })).toHaveValue('חדש');
    expect(onDone).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it('leaves without saving on cancel', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each(['night', 'day'] as const)('paints the text field with the %s theme tokens', (id) => {
    usePreferences.setState({ themePreference: id });
    setup();
    expect(screen.getByRole('textbox', { name: 'פירוט' })).toHaveStyle({ color: themes[id].color.ink });
  });
});
