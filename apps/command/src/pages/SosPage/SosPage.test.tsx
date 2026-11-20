import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SosPage, type SosPageProps } from '.';
import { participants, sosActive, sosClosed, sosList } from '../../mission/fixtures';

function renderPage(props: Partial<SosPageProps> = {}) {
  const onClose = vi.fn();
  render(
    <SosPage
      sos={sosList}
      loadFailed={false}
      onRetry={vi.fn()}
      participants={participants}
      onClose={onClose}
      closingId={null}
      error={null}
      {...props}
    />,
  );
  return { onClose };
}

describe('SosPage', () => {
  it('shows the active SOS first with its sender, polygon, message, location and recipients', () => {
    renderPage();
    const card = screen.getByRole('article', { name: 'SOS פעיל של דנה כהן' });
    expect(within(card).getByText('04')).toBeTruthy();
    expect(card.textContent).toContain('ואדי צפוני');
    expect(within(card).getByText('נפלתי, כאב ברגל')).toBeTruthy();
    expect(card.textContent).toContain('31.7733');
    expect(card.textContent).toContain('דיוק ±8 מ׳');
    expect(card.textContent).toContain('נשלחה למנהל ול-3 מחפשים');
    expect(within(card).getByText('16:58', { selector: 'time' })).toBeTruthy();
  });

  it('calls the sender with a tel link to their phone', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'התקשר לדנה כהן' })).toHaveAttribute('href', 'tel:+972526114085');
  });

  it('shows no call link when the sender is not in the pool', () => {
    renderPage({ participants: [] });
    expect(screen.queryByRole('link', { name: /התקשר/ })).toBeNull();
  });

  it('lists the closed SOS as history with who closed it and when', () => {
    renderPage();
    const history = screen.getByRole('region', { name: /היסטוריית SOS/ });
    expect(history.textContent).toContain('מיכל פרץ');
    expect(history.textContent).toContain('ללא הודעה');
    expect(history.textContent).toContain('נסגר');
    expect(within(history).getByText('15:26')).toBeTruthy();
    expect(history.textContent).toContain('מנהל (מנהל מסע)');
  });

  it('closes the SOS only after the commander confirms', () => {
    const { onClose } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'סגור SOS…' }));
    expect(onClose).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'אישור סגירת SOS של דנה כהן' });
    expect(dialog.textContent).toContain('לסגור את ה-SOS של דנה כהן?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'סגור SOS' }));
    expect(onClose).toHaveBeenCalledWith(sosActive.id);
  });

  it('does not close when the commander cancels', () => {
    const { onClose } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'סגור SOS…' }));
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the close as pending and blocks it', () => {
    renderPage({ closingId: sosActive.id });
    expect(screen.getByRole('button', { name: 'סוגר…' })).toBeDisabled();
  });

  it('blocks closing without a connection', () => {
    renderPage({ onClose: undefined });
    expect(screen.getByRole('button', { name: 'סגור SOS…' })).toBeDisabled();
  });

  it('shows the failure to close', () => {
    renderPage({ error: 'אין חיבור לשרת. ה-SOS לא נסגר.' });
    expect(screen.getByRole('alert').textContent).toContain('אין חיבור לשרת');
  });

  it('says when no SOS was ever sent', () => {
    renderPage({ sos: [] });
    expect(screen.getByText('אין קריאות SOS במסע')).toBeTruthy();
  });

  it('says there is no active SOS when only closed ones remain', () => {
    renderPage({ sos: [sosClosed] });
    expect(screen.getByText('אין קריאות SOS פעילות.')).toBeTruthy();
    expect(screen.getByRole('region', { name: /היסטוריית SOS/ })).toBeTruthy();
  });

  it('shows loading and a failure with retry', () => {
    const onRetry = vi.fn();
    const { unmount } = render(
      <SosPage sos={undefined} loadFailed={false} onRetry={onRetry} participants={[]} closingId={null} error={null} />,
    );
    expect(screen.getByText('טוען קריאות SOS…')).toBeTruthy();
    unmount();
    render(<SosPage sos={undefined} loadFailed onRetry={onRetry} participants={[]} closingId={null} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
