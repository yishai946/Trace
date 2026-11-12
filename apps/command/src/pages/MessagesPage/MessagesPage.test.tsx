import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessagesPage, type MessagesPageProps } from '.';
import { messageCritical, messageNormal, messageToOne, participants, polygonA, polygonB } from '../../mission/fixtures';

const props = (overrides: Partial<MessagesPageProps> = {}): MessagesPageProps => ({
  messages: [messageCritical, messageNormal, messageToOne],
  loadFailed: false,
  onRetry: vi.fn(),
  participants,
  participantsFailed: false,
  polygons: [polygonA, polygonB],
  ended: false,
  onSend: vi.fn(),
  sending: false,
  sendError: null,
  ...overrides,
});

const sentRows = () =>
  within(within(screen.getByRole('region', { name: 'הודעות שנשלחו' })).getByRole('table'))
    .getAllByRole('row')
    .slice(1);
const detail = () => screen.getByRole('region', { name: 'פירוט לפי נמען' });
const detailRows = () => within(within(detail()).getByRole('table')).getAllByRole('row').slice(1);

describe('MessagesPage', () => {
  it('C1: shows Sent, Read and Acknowledged for each recipient of a critical message', () => {
    render(<MessagesPage {...props()} />);

    expect(detailRows().map((row) => within(row).getByText(/נשלחה|נמסרה|נקראה|אושרה/).textContent)).toEqual([
      'נמסרה',
      'נקראה',
      'אושרה',
    ]);
    const counts = detail().textContent ?? '';
    expect(counts).toContain('נמסרה 3/3');
    expect(counts).toContain('נקראה 2/3');
    expect(counts).toContain('אושרה 1/3');
  });

  it('C1: has no acknowledged count for a normal message and shows the one waiting for delivery', () => {
    render(<MessagesPage {...props({ messages: [messageNormal] })} />);

    expect(detail().textContent).not.toContain('אושרה');
    expect(within(detail()).getByText('נשלחה, ממתין למסירה')).toBeInTheDocument();
  });

  it('C2: updates the detail and the summary when a recipient reads', () => {
    const { rerender } = render(<MessagesPage {...props({ messages: [messageNormal] })} />);
    expect(within(sentRows()[0] as HTMLElement).getByText('נקראה 1 מתוך 2')).toBeInTheDocument();

    const [first, waiting] = messageNormal.recipients;
    if (!first || !waiting) throw new Error('fixture');
    const read = {
      ...waiting,
      status: 'read' as const,
      deliveredAt: '2026-10-03T13:40:00.000Z',
      readAt: '2026-10-03T13:41:00.000Z',
    };
    rerender(<MessagesPage {...props({ messages: [{ ...messageNormal, recipients: [first, read] }] })} />);

    expect(within(sentRows()[0] as HTMLElement).getByText('נקראה 2 מתוך 2')).toBeInTheDocument();
    expect(within(detail()).queryByText('נשלחה, ממתין למסירה')).toBeNull();
    expect(detailRows().filter((row) => within(row).queryByText('נקראה'))).toHaveLength(2);
  });

  it('C3: lists messages newest first with recipients, urgency, time and summary, the first selected', () => {
    render(<MessagesPage {...props()} />);

    const rows = sentRows();
    expect(rows).toHaveLength(3);
    const first = rows[0] as HTMLElement;
    expect(within(first).getByText(messageCritical.body)).toBeInTheDocument();
    expect(within(first).getByText('כלל המסע, 3')).toBeInTheDocument();
    expect(within(first).getByText('קריטית')).toBeInTheDocument();
    expect(within(first).getByText('נקראה 2, אושרה 1')).toBeInTheDocument();
    expect(first.hasAttribute('data-selected')).toBe(true);
    expect(rows[1]?.hasAttribute('data-selected')).toBe(false);
    expect(within(rows[2] as HTMLElement).getByText('09 מיכל פרץ')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('חשובה')).toBeInTheDocument();
  });

  it('C4: pressing a message shows its detail', () => {
    render(<MessagesPage {...props()} />);
    fireEvent.click(within(sentRows()[1] as HTMLElement).getByRole('link'));

    expect(sentRows()[1]?.hasAttribute('data-selected')).toBe(true);
    expect(detail().textContent).toContain('ואדי צפוני, 2');
    expect(detailRows()).toHaveLength(2);
  });

  describe('compose', () => {
    const send = () => screen.getByRole('button', { name: /^שלח/ });
    const text = () => screen.getByRole('textbox', { name: 'טקסט חופשי' });

    it('C5: the recipient count follows the target', () => {
      render(<MessagesPage {...props()} />);
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
      render(<MessagesPage {...props({ onSend })} />);

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
      render(<MessagesPage {...props({ onSend })} />);

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

    it('C8: blocks sending when ended or offline, keeping the history', () => {
      const { rerender } = render(<MessagesPage {...props({ onSend: undefined, ended: true })} />);
      expect(send()).toBeDisabled();
      expect(screen.getByText('המסע הסתיים. אי אפשר לשלוח הודעות.')).toBeInTheDocument();
      expect(sentRows()).toHaveLength(3);

      rerender(<MessagesPage {...props({ onSend: undefined })} />);
      expect(screen.getByText('אין חיבור לשרת. שליחה חסומה.')).toBeInTheDocument();
    });

    it('C9: shows a send error', () => {
      render(<MessagesPage {...props({ sendError: 'אין חיבור לשרת. ההודעה לא נשלחה.' })} />);
      expect(screen.getByRole('alert').textContent).toBe('אין חיבור לשרת. ההודעה לא נשלחה.');
    });

    it('C11: states loading, failed and empty searcher and polygon lists', () => {
      const { rerender } = render(<MessagesPage {...props({ participants: undefined })} />);
      fireEvent.click(screen.getByRole('radio', { name: 'מחפש' }));
      expect(screen.getByText('טוען מחפשים…')).toBeInTheDocument();

      rerender(<MessagesPage {...props({ participants: undefined, participantsFailed: true })} />);
      expect(screen.getByText('לא ניתן לטעון את המחפשים מהשרת.')).toBeInTheDocument();
      expect(send()).toBeDisabled();

      rerender(<MessagesPage {...props({ polygons: [] })} />);
      fireEvent.click(screen.getByRole('radio', { name: 'פוליגון' }));
      expect(screen.getByText('אין פוליגונים במפה.')).toBeInTheDocument();
    });

    it('chooses one searcher by callsign', () => {
      const onSend = vi.fn();
      render(<MessagesPage {...props({ onSend })} />);
      fireEvent.click(screen.getByRole('radio', { name: 'מחפש' }));
      fireEvent.click(
        within(screen.getByRole('radiogroup', { name: 'מחפש' })).getByRole('radio', { name: /מיכל פרץ/ }),
      );
      fireEvent.change(text(), { target: { value: 'שלום' } });
      fireEvent.click(send());
      expect(onSend.mock.calls[0]?.[0]).toEqual({
        target: { kind: 'searcher', participantId: participants[1]?.id },
        urgency: 'normal',
        body: 'שלום',
      });
    });
  });

  it('C10: states loading, a failed load with retry, and no messages', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<MessagesPage {...props({ messages: undefined })} />);
    expect(screen.getByText('טוען הודעות…')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'פירוט לפי נמען' })).toBeNull();

    rerender(<MessagesPage {...props({ messages: undefined, loadFailed: true, onRetry })} />);
    expect(screen.getByText('לא ניתן לטעון את ההודעות מהשרת.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<MessagesPage {...props({ messages: [] })} />);
    expect(screen.getByText('עוד לא נשלחו הודעות במסע הזה.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'פירוט לפי נמען' })).toBeNull();
  });

  it('C12: offers a call only for recipients who are not final', () => {
    render(<MessagesPage {...props()} />);
    const [waiting, , acknowledged] = detailRows();
    const call = within(waiting as HTMLElement).getByRole('link', { name: 'התקשר למיכל פרץ' });
    expect(call.getAttribute('href')).toBe('tel:+972503371602');
    expect(within(acknowledged as HTMLElement).queryByRole('link')).toBeNull();

    render(<MessagesPage {...props({ messages: [messageNormal] })} />);
    const normal = within(screen.getAllByRole('region', { name: 'פירוט לפי נמען' })[1] as HTMLElement);
    expect(normal.queryAllByRole('link', { name: /התקשר/ })).toHaveLength(0);
  });
});
