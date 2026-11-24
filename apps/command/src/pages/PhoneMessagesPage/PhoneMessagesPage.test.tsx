import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhoneMessagesPage, type PhoneMessagesPageProps } from '.';
import { OFFLINE_NOTE } from '../../mission/messageView';
import { messageCritical, messageNormal, messageToOne, participants, polygonA, polygonB } from '../../mission/fixtures';

const up = { state: 'up', label: 'זמין', detail: 'מחובר לשרת. המפה מתעדכנת בזמן אמת.' } as const;

const props = (overrides: Partial<PhoneMessagesPageProps> = {}): PhoneMessagesPageProps => ({
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
  connection: up,
  ...overrides,
});

const latest = () => screen.getByRole('region', { name: 'נשלחה לאחרונה' });
const detail = () => screen.getByRole('region', { name: 'פירוט לפי נמען' });
const send = () => screen.getByRole('button', { name: /^שלח/ });
const text = () => screen.getByRole('textbox', { name: 'טקסט חופשי' });
const openSent = () => fireEvent.click(screen.getByRole('tab', { name: 'נשלחו' }));
const openDetail = () => {
  openSent();
  fireEvent.click(within(screen.getByRole('region', { name: 'הודעות שנשלחו' })).getAllByRole('link')[0] as HTMLElement);
};
const states = () =>
  within(within(detail()).getByRole('list', { name: 'נמענים' }))
    .getAllByRole('listitem')
    .map((item) => within(item).getByText(/^(נשלחה|נמסרה|נקראה|אושרה)/).textContent);

describe('PhoneMessagesPage', () => {
  it('PMS1: shows the title, the two views, the form and the templates', () => {
    render(<PhoneMessagesPage {...props()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'הודעות' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /^זמין/ })).toBeInTheDocument();
    const views = screen.getByRole('tablist', { name: 'תצוגה' });
    expect(within(views).getByRole('tab', { name: 'חדשה', selected: true })).toBeInTheDocument();
    expect(within(views).getByRole('tab', { name: 'נשלחו' })).toBeInTheDocument();
    for (const name of ['כלל המסע', 'פוליגון', 'מחפש', 'רגילה', 'חשובה', 'קריטית']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(text()).toBeInTheDocument();
    expect(send().textContent).toBe('שלח ל-2 מחפשים');
    expect(screen.queryByRole('heading', { name: 'הודעה חדשה' })).toBeNull();
    expect(screen.getByRole('group', { name: 'תבניות' })).toBeInTheDocument();
  });

  it('PMS2: sends the chosen target, urgency and trimmed text, then clears and stays on the new view', () => {
    const onSend = vi.fn();
    render(<PhoneMessagesPage {...props({ onSend })} />);
    fireEvent.click(screen.getByRole('radio', { name: 'פוליגון' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'פוליגונים' })).getByRole('checkbox', { name: /ואדי צפוני/ }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'קריטית' }));
    fireEvent.change(text(), { target: { value: '  חזרו לכינוס  ' } });
    fireEvent.click(send());

    expect(onSend.mock.calls[0]?.[0]).toEqual({
      target: { kind: 'polygons', polygonIds: [polygonA.id] },
      urgency: 'critical',
      body: 'חזרו לכינוס',
    });
    const onSent = onSend.mock.calls[0]?.[1] as (message: typeof messageNormal) => void;
    act(() => onSent(messageNormal));
    expect((text() as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByRole('status', { name: '' }).textContent).toBe('ההודעה נשלחה ל-2 מחפשים.');
    expect(screen.getByRole('tab', { name: 'חדשה', selected: true })).toBeInTheDocument();
  });

  it('PMS3: shows the latest message with its read and acknowledged fractions', () => {
    render(<PhoneMessagesPage {...props()} />);
    const card = within(latest());
    expect(latest().textContent).toContain('נשלחה לאחרונה, 17:10');
    expect(card.getByText('קריטית')).toBeInTheDocument();
    expect(card.getByText(messageCritical.body)).toBeInTheDocument();
    expect(latest().textContent).toContain('נקראה 2/3');
    expect(latest().textContent).toContain('אושרה 1/3');
    expect(card.getByRole('link', { name: 'פירוט לפי נמען' })).toBeInTheDocument();
  });

  it('PMS4: has no acknowledged fraction for a normal message', () => {
    render(<PhoneMessagesPage {...props({ messages: [messageNormal] })} />);
    expect(latest().textContent).toContain('נקראה 1/2');
    expect(latest().textContent).not.toContain('אושרה');
  });

  it('PMS5: shows no card without messages', () => {
    const { rerender } = render(<PhoneMessagesPage {...props({ messages: undefined })} />);
    expect(screen.queryByRole('region', { name: 'נשלחה לאחרונה' })).toBeNull();
    rerender(<PhoneMessagesPage {...props({ messages: [] })} />);
    expect(screen.queryByRole('region', { name: 'נשלחה לאחרונה' })).toBeNull();
  });

  it('PMS6: opens the recipients of a message with states, counts and the full body', () => {
    render(<PhoneMessagesPage {...props()} />);
    fireEvent.click(within(latest()).getByRole('link', { name: 'פירוט לפי נמען' }));
    expect(screen.getByRole('tab', { name: 'נשלחו', selected: true })).toBeInTheDocument();
    expect(states()).toEqual(['נמסרה', 'נקראה', 'אושרה']);
    expect(detail().textContent).toContain('נמסרה 3/3');
    expect(detail().textContent).toContain('נקראה 2/3');
    expect(detail().textContent).toContain('אושרה 1/3');
    expect(within(detail()).getByText(messageCritical.body)).toBeInTheDocument();
    expect(within(detail()).getByRole('heading', { name: 'פירוט לפי נמען' })).toHaveFocus();
  });

  it('PMS7: lists the sent messages newest first', () => {
    render(<PhoneMessagesPage {...props()} />);
    openSent();
    const list = within(screen.getByRole('region', { name: 'הודעות שנשלחו' }));
    const cards = list.getAllByRole('region');
    expect(cards).toHaveLength(3);
    expect(cards[0]?.textContent).toContain('כלל המסע, 3');
    expect(cards[1]?.textContent).toContain('ואדי צפוני, 2');
    expect(cards[2]?.textContent).toContain('09 מיכל פרץ');
    expect(cards.map((card) => within(card).getByText(/^(קריטית|רגילה|חשובה)$/).textContent)).toEqual([
      'קריטית',
      'רגילה',
      'חשובה',
    ]);
  });

  it('PMS8: back from the recipients returns to the list with focus', () => {
    render(<PhoneMessagesPage {...props()} />);
    openDetail();
    fireEvent.click(screen.getByRole('button', { name: 'חזרה להודעות שנשלחו' }));
    expect(screen.queryByRole('region', { name: 'פירוט לפי נמען' })).toBeNull();
    expect(screen.getByRole('region', { name: 'הודעות שנשלחו' })).toHaveFocus();
  });

  it('PMS9: follows a recipient who reads, in the card and in the recipients', () => {
    const { rerender } = render(<PhoneMessagesPage {...props({ messages: [messageNormal] })} />);
    openDetail();
    expect(within(detail()).getByText('נשלחה, ממתין למסירה')).toBeInTheDocument();

    const [first, waiting] = messageNormal.recipients;
    if (!first || !waiting) throw new Error('fixture');
    const read = {
      ...waiting,
      status: 'read' as const,
      deliveredAt: '2026-10-03T13:40:00.000Z',
      readAt: '2026-10-03T13:41:00.000Z',
    };
    rerender(<PhoneMessagesPage {...props({ messages: [{ ...messageNormal, recipients: [first, read] }] })} />);
    expect(detail().textContent).toContain('נקראה 2/2');
    expect(within(detail()).queryByText('נשלחה, ממתין למסירה')).toBeNull();
  });

  it('PMS9: shows the new count on the latest card of the new view', () => {
    const [first, waiting] = messageNormal.recipients;
    if (!first || !waiting) throw new Error('fixture');
    const read = { ...waiting, status: 'read' as const, deliveredAt: first.deliveredAt, readAt: first.readAt };
    render(<PhoneMessagesPage {...props({ messages: [{ ...messageNormal, recipients: [first, read] }] })} />);
    expect(latest().textContent).toContain('נקראה 2/2');
  });

  it('PMS10: says an offline recipient waits for delivery, and that the message is kept (decision 77)', () => {
    render(<PhoneMessagesPage {...props({ messages: [messageNormal] })} />);
    openDetail();
    expect(within(detail()).getByText('נשלחה, ממתין למסירה')).toBeInTheDocument();
    expect(detail().textContent).toContain(OFFLINE_NOTE);
  });

  it('PMS11: offers a call to recipients who are not final (decision 78)', () => {
    render(<PhoneMessagesPage {...props()} />);
    openDetail();
    const items = within(within(detail()).getByRole('list', { name: 'נמענים' })).getAllByRole('listitem');
    const call = within(items[0] as HTMLElement).getByRole('link', { name: 'התקשר למיכל פרץ' });
    expect(call.getAttribute('href')).toBe('tel:+972503371602');
    expect(within(items[2] as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('PMS12: states loading, a failed load with retry, and no messages in the sent view', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<PhoneMessagesPage {...props({ messages: undefined })} />);
    openSent();
    expect(screen.getByText('טוען הודעות…')).toBeInTheDocument();

    rerender(<PhoneMessagesPage {...props({ messages: undefined, loadFailed: true, onRetry })} />);
    expect(screen.getByText('לא ניתן לטעון את ההודעות מהשרת.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<PhoneMessagesPage {...props({ messages: [] })} />);
    expect(screen.getByText('עוד לא נשלחו הודעות במסע הזה.')).toBeInTheDocument();
  });

  it('PMS13: blocks sending when the mission ended and keeps the history', () => {
    render(<PhoneMessagesPage {...props({ ended: true, onSend: undefined })} />);
    expect(send()).toBeDisabled();
    expect(screen.getByText('המסע הסתיים. אי אפשר לשלוח הודעות.')).toBeInTheDocument();
    openSent();
    expect(within(screen.getByRole('region', { name: 'הודעות שנשלחו' })).getAllByRole('region')).toHaveLength(3);
  });

  it('PMS14: blocks sending without a connection and shows the connection light', () => {
    const connection = { state: 'down', label: 'לא Live', detail: 'אין חיבור לשרת.' } as const;
    render(<PhoneMessagesPage {...props({ onSend: undefined, connection })} />);
    expect(screen.getByText('אין חיבור לשרת. שליחה חסומה.')).toBeInTheDocument();
    expect(send()).toBeDisabled();
    expect(screen.getByRole('status', { name: /^לא Live/ })).toBeInTheDocument();
  });

  it('PMS15: sends once when the button is clicked twice', () => {
    const onSend = vi.fn();
    render(<PhoneMessagesPage {...props({ onSend })} />);
    fireEvent.change(text(), { target: { value: 'שלום' } });
    fireEvent.click(send());
    fireEvent.click(send());
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('PMS16: shows a send error', () => {
    render(<PhoneMessagesPage {...props({ sendError: 'אין חיבור לשרת. ההודעה לא נשלחה.' })} />);
    expect(screen.getByRole('alert').textContent).toBe('אין חיבור לשרת. ההודעה לא נשלחה.');
  });

  it('PMS17: shows the list when the open message is gone', () => {
    const { rerender } = render(<PhoneMessagesPage {...props()} />);
    openDetail();
    rerender(<PhoneMessagesPage {...props({ messages: [messageNormal, messageToOne] })} />);
    expect(screen.queryByRole('region', { name: 'פירוט לפי נמען' })).toBeNull();
    expect(screen.getByRole('region', { name: 'הודעות שנשלחו' })).toBeInTheDocument();
  });
});
