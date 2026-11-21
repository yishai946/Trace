import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('C8: keeps the history when sending is blocked', () => {
    render(<MessagesPage {...props({ onSend: undefined, ended: true })} />);
    expect(sentRows()).toHaveLength(3);
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
