import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComposeMessage, type ComposeMessageProps } from '.';
import { messageNormal, participants, polygonA, polygonB } from '../fixtures';

const composeProps = (overrides: Partial<ComposeMessageProps> = {}): ComposeMessageProps => ({
  participants,
  participantsFailed: false,
  polygons: [polygonA, polygonB],
  ended: false,
  onSend: vi.fn(),
  sending: false,
  sendError: null,
  onSent: vi.fn(),
  ...overrides,
});

const send = () => screen.getByRole('button', { name: /^שלח/ });
const text = () => screen.getByRole('textbox', { name: 'טקסט חופשי' });

describe('ComposeMessage', () => {
  it('C5: the recipient count follows the target', () => {
    render(<ComposeMessage {...composeProps()} />);
    expect(send().textContent).toBe('שלח ל-2 מחפשים');

    fireEvent.click(screen.getByRole('radio', { name: 'פוליגון' }));
    expect(send().textContent).toBe('שלח');
    const group = screen.getByRole('group', { name: 'פוליגונים' });
    expect(within(group).getByText('מחפש אחד')).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('checkbox', { name: /ואדי צפוני/ }));
    expect(send().textContent).toBe('שלח למחפש אחד');
  });

  it('C6: asks for the missing parts and does not send', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend })} />);

    fireEvent.click(send());
    expect(screen.getByText('כתבו את ההודעה.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'פוליגון' }));
    fireEvent.click(send());
    expect(screen.getByText('בחרו לפחות פוליגון אחד.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'מחפש' }));
    fireEvent.click(send());
    expect(screen.getByText('בחרו מחפש.')).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('C7: sends the trimmed message, then clears the text and announces it', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend })} />);

    fireEvent.click(screen.getByRole('radio', { name: 'פוליגון' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'פוליגונים' })).getByRole('checkbox', { name: /ואדי צפוני/ }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'קריטית' }));
    fireEvent.change(text(), { target: { value: '  חזרו לכינוס  ' } });
    fireEvent.click(send());

    expect(onSend).toHaveBeenCalledWith(
      { target: { kind: 'polygons', polygonIds: [polygonA.id] }, urgency: 'critical', body: 'חזרו לכינוס' },
      expect.any(Function),
    );
    const onSent = onSend.mock.calls[0]?.[1] as (message: typeof messageNormal) => void;
    // The server saved it.
    act(() => onSent(messageNormal));
    expect((text() as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByRole('status').textContent).toBe('ההודעה נשלחה ל-2 מחפשים.');
  });

  it('C6: sends once when the button is double clicked', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend })} />);
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.click(send());
    fireEvent.click(send());
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('C6: announces the missing text as an alert and moves focus to the field', () => {
    render(<ComposeMessage {...composeProps()} />);
    fireEvent.click(send());
    expect(screen.getByRole('alert').textContent).toBe('כתבו את ההודעה.');
    expect(text()).toHaveFocus();
  });

  it('C6: moves focus to the missing target', () => {
    render(<ComposeMessage {...composeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'מחפש' }));
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.click(send());
    expect(within(screen.getByRole('radiogroup', { name: 'מחפש' })).getAllByRole('radio')[0]).toHaveFocus();
  });

  it('C9: clears the send error when the text or the target changes', () => {
    render(<ComposeMessage {...composeProps({ sendError: 'אין חיבור לשרת. ההודעה לא נשלחה.' })} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(text(), { target: { value: 'ש' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('C9: clears the send error when the target changes', () => {
    render(<ComposeMessage {...composeProps({ sendError: 'אין חיבור לשרת. ההודעה לא נשלחה.' })} />);
    fireEvent.click(screen.getByRole('radio', { name: 'מחפש' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('C7: returns focus to the text field after a send', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend })} />);
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.click(send());
    act(() => (onSend.mock.calls[0]?.[1] as (message: typeof messageNormal) => void)(messageNormal));
    expect(text()).toHaveFocus();
  });

  it('C8: blocks sending when ended or offline', () => {
    const { rerender } = render(<ComposeMessage {...composeProps({ onSend: undefined, ended: true })} />);
    expect(send()).toBeDisabled();
    expect(screen.getByText('המסע הסתיים. אי אפשר לשלוח הודעות.')).toBeInTheDocument();

    rerender(<ComposeMessage {...composeProps({ onSend: undefined })} />);
    expect(screen.getByText('אין חיבור לשרת. שליחה חסומה.')).toBeInTheDocument();
  });

  it('C9: shows a send error', () => {
    render(<ComposeMessage {...composeProps({ sendError: 'אין חיבור לשרת. ההודעה לא נשלחה.' })} />);
    expect(screen.getByRole('alert').textContent).toBe('אין חיבור לשרת. ההודעה לא נשלחה.');
  });

  it('C11: states loading, failed and empty searcher and polygon lists', () => {
    const { rerender } = render(<ComposeMessage {...composeProps({ participants: undefined })} />);
    fireEvent.click(screen.getByRole('radio', { name: 'מחפש' }));
    expect(screen.getByText('טוען מחפשים…')).toBeInTheDocument();

    rerender(<ComposeMessage {...composeProps({ participants: undefined, participantsFailed: true })} />);
    expect(screen.getByText('לא ניתן לטעון את המחפשים מהשרת.')).toBeInTheDocument();
    expect(send()).toBeDisabled();

    rerender(<ComposeMessage {...composeProps({ polygons: [] })} />);
    fireEvent.click(screen.getByRole('radio', { name: 'פוליגון' }));
    expect(screen.getByText('אין פוליגונים במפה.')).toBeInTheDocument();
  });

  it('chooses one searcher by callsign', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend })} />);
    fireEvent.click(screen.getByRole('radio', { name: 'מחפש' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'מחפש' })).getByRole('radio', { name: /מיכל פרץ/ }));
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.click(send());
    expect(onSend.mock.calls[0]?.[0]).toEqual({
      target: { kind: 'searcher', participantId: participants[1]?.id },
      urgency: 'normal',
      body: 'שלום',
    });
  });

  it('CM1: on the phone has no header, a shorter text field and keeps the form name', () => {
    const { rerender } = render(<ComposeMessage {...composeProps()} phone />);
    expect(screen.queryByRole('heading', { name: 'הודעה חדשה' })).toBeNull();
    expect(screen.getByRole('form', { name: 'הודעה חדשה' })).toBeInTheDocument();
    expect(text()).toHaveAttribute('rows', '3');

    rerender(<ComposeMessage {...composeProps()} />);
    expect(screen.getByRole('heading', { name: 'הודעה חדשה' })).toBeInTheDocument();
    expect(text()).toHaveAttribute('rows', '4');
  });

  it('CM2: sends and clears the text without an onSent callback', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend, onSent: undefined })} />);
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.click(send());
    act(() => (onSend.mock.calls[0]?.[1] as (message: typeof messageNormal) => void)(messageNormal));
    expect((text() as HTMLTextAreaElement).value).toBe('');
  });

  it('blocks sending to a polygon with no searchers, before any request', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend })} />);
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.click(screen.getByRole('radio', { name: 'פוליגון' }));
    expect(screen.queryByText('אין מחפשים פעילים ביעד שנבחר.')).toBeNull();

    fireEvent.click(
      within(screen.getByRole('group', { name: 'פוליגונים' })).getByRole('checkbox', { name: /פוליגון 2/ }),
    );
    expect(screen.getByText('אין מחפשים פעילים ביעד שנבחר.')).toBeInTheDocument();
    expect(send()).toBeDisabled();
    fireEvent.click(send());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('blocks sending to the whole mission when it has no searchers, but not while they load', () => {
    const { rerender } = render(<ComposeMessage {...composeProps({ participants: undefined })} />);
    expect(send()).not.toBeDisabled();

    rerender(<ComposeMessage {...composeProps({ participants: [] })} />);
    expect(screen.getByText('אין מחפשים פעילים ביעד שנבחר.')).toBeInTheDocument();
    expect(send()).toBeDisabled();
  });

  it('does not send a no-recipient target even when the form is submitted directly', () => {
    const onSend = vi.fn();
    render(<ComposeMessage {...composeProps({ onSend, participants: [] })} />);
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.submit(screen.getByRole('form', { name: 'הודעה חדשה' }));
    expect(onSend).not.toHaveBeenCalled();
  });
});
