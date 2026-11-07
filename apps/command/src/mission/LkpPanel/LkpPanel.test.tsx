import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LkpPanel } from '.';
import { lkps, mission, sightingA, sightingB } from '../fixtures';

const handlers = () => ({
  onRetry: vi.fn(),
  onStartAdd: vi.fn(),
  onCancelAdd: vi.fn(),
  onSubmit: vi.fn(),
  onDecide: vi.fn(),
  onClose: vi.fn(),
});

type Props = Partial<Parameters<typeof LkpPanel>[0]>;

function renderPanel(props: Props = {}) {
  const h = handlers();
  render(
    <LkpPanel
      mission={mission}
      lkps={lkps}
      sightings={[sightingA, sightingB]}
      loading={false}
      loadFailed={false}
      canChange
      busy={false}
      error={null}
      selectedSightingId={null}
      adding={null}
      {...h}
      {...props}
    />,
  );
  return h;
}

describe('LkpPanel', () => {
  it('shows the current LKP with its time, who set it and its coordinates', () => {
    renderPanel();
    const panel = screen.getByRole('complementary', { name: 'LKP ותצפיות' });
    expect(within(panel).getByText('LKP אחד פעיל, 2 תצפיות')).toBeTruthy();
    expect(within(panel).getByText('13:05')).toBeTruthy();
    expect(within(panel).getByText('ישי')).toBeTruthy();
    const coordinates = within(panel).getByText('31.7690, 35.1370');
    expect(coordinates.getAttribute('dir')).toBe('ltr');
  });

  it('lists past LKPs with their time', () => {
    renderPanel();
    const history = screen.getByRole('list', { name: 'היסטוריה' });
    expect(within(history).getByText('LKP קודם, 31.7398, 35.1398')).toBeTruthy();
    expect(within(history).getByText('12:10')).toBeTruthy();
  });

  it('says so when there are no past LKPs', () => {
    renderPanel({ lkps: [lkps[0]!] });
    expect(screen.getByText('אין LKP קודמים.')).toBeTruthy();
  });

  it('suggests the candidate sighting, and approving or rejecting calls back', () => {
    const h = renderPanel();
    expect(screen.getByText('הצעת TRACE')).toBeTruthy();
    expect(screen.getByText('תצפית 1 (עד ראייה, 14:22) מאוחרת מה-LKP הנוכחי. להפוך אותה ל-LKP?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'אשר' }));
    expect(h.onDecide).toHaveBeenCalledWith(sightingA.id, 'accepted');
    fireEvent.click(screen.getByRole('button', { name: 'דחה' }));
    expect(h.onDecide).toHaveBeenCalledWith(sightingA.id, 'rejected');
  });

  it('shows no suggestion once no sighting is a candidate', () => {
    renderPanel({ sightings: [sightingB] });
    expect(screen.queryByText('הצעת TRACE')).toBeNull();
    expect(screen.queryByRole('button', { name: 'אשר' })).toBeNull();
  });

  it('marks a candidate row, and a rejected row has no promote button', () => {
    const h = renderPanel();
    const [first, second] = screen.getAllByRole('listitem').filter((li) => li.closest('[aria-label="תצפיות"]'));
    expect(within(first!).getByText('מוצע כ-LKP')).toBeTruthy();
    expect(within(first!).getByText('עד ראייה')).toBeTruthy();
    expect(within(first!).getByText('מטייל ראה אדם עם כובע אפור')).toBeTruthy();
    fireEvent.click(within(first!).getByRole('button', { name: 'הפוך ל-LKP' }));
    expect(h.onDecide).toHaveBeenCalledWith(sightingA.id, 'accepted');
    expect(within(second!).getByText('נדחה')).toBeTruthy();
    expect(within(second!).getByText('מנהל')).toBeTruthy();
    expect(within(second!).queryByRole('button')).toBeNull();
  });

  it('marks the selected sighting', () => {
    renderPanel({ selectedSightingId: sightingB.id });
    const rows = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('aria-current'));
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText('נדחה')).toBeTruthy();
  });

  it('shows loading, failure with retry, and empty states', () => {
    renderPanel({ loading: true, sightings: undefined });
    expect(screen.getByText('טוען תצפיות…')).toBeTruthy();
  });

  it('offers a retry when the sightings did not load', () => {
    const h = renderPanel({ loadFailed: true, sightings: undefined });
    expect(screen.getByRole('alert').textContent).toContain('התצפיות לא נטענו.');
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(h.onRetry).toHaveBeenCalledOnce();
  });

  it('says so when there are no sightings', () => {
    renderPanel({ sightings: [] });
    expect(screen.getByText('אין תצפיות עדיין.')).toBeTruthy();
  });

  it('blocks adding and deciding when changes are not allowed', () => {
    renderPanel({ canChange: false });
    expect(screen.getByRole('button', { name: 'הוסף תצפית' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'אשר' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'דחה' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'הפוך ל-LKP' }).hasAttribute('disabled')).toBe(true);
  });

  it('is read-only once the mission ended', () => {
    renderPanel({ mission: { ...mission, status: 'ended_located' }, canChange: false });
    expect(screen.getByText('המסע הסתיים. LKP ותצפיות לקריאה בלבד.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'הוסף תצפית' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'אשר' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'הפוך ל-LKP' })).toBeNull();
  });

  it('shows an action error as an alert', () => {
    renderPanel({ error: 'השינוי לא נשמר. נסו שוב.' });
    expect(screen.getByRole('alert').textContent).toBe('השינוי לא נשמר. נסו שוב.');
  });

  it('starts adding from the add button and closes with the close button', () => {
    const h = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תצפית' }));
    expect(h.onStartAdd).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    expect(h.onClose).toHaveBeenCalledOnce();
  });

  describe('add form', () => {
    it('asks for a spot on the map, and shows it once chosen', () => {
      renderPanel({ adding: { position: null } });
      expect(screen.getByText('לחצו על המפה למיקום התצפית.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'הוסף תצפית' })).toBeNull();
    });

    it('shows the chosen coordinates left to right', () => {
      renderPanel({ adding: { position: [35.14, 31.77] } });
      expect(screen.getByText('31.7700, 35.1400').getAttribute('dir')).toBe('ltr');
      expect(screen.getByText('לחצו שוב להזזה.')).toBeTruthy();
    });

    it('names each missing field instead of saving', () => {
      const h = renderPanel({ adding: { position: null } });
      fireEvent.click(screen.getByRole('button', { name: 'שמור תצפית' }));
      const messages = screen.getAllByRole('alert').map((a) => a.textContent);
      expect(messages).toContain('בחרו מיקום במפה.');
      expect(messages).toContain('בחרו מקור: אני או עד ראייה.');
      expect(h.onSubmit).not.toHaveBeenCalled();
    });

    it('saves a complete sighting', () => {
      const h = renderPanel({ adding: { position: [35.14, 31.77] } });
      fireEvent.click(screen.getByRole('radio', { name: 'עד ראייה' }));
      fireEvent.change(screen.getByLabelText('תיאור קצר'), { target: { value: ' כובע אפור ' } });
      fireEvent.click(screen.getByRole('button', { name: 'שמור תצפית' }));
      expect(h.onSubmit).toHaveBeenCalledOnce();
      expect(h.onSubmit.mock.calls[0]?.[0]).toMatchObject({
        position: { type: 'Point', coordinates: [35.14, 31.77] },
        source: 'witness',
        description: 'כובע אפור',
      });
    });

    it('cancels', () => {
      const h = renderPanel({ adding: { position: null } });
      fireEvent.click(screen.getByRole('button', { name: 'בטל' }));
      expect(h.onCancelAdd).toHaveBeenCalledOnce();
    });
  });
});
