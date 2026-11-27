import type { MapProvider } from '@trace/map';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mission } from '../fixtures';
import { MissionControlPanel } from '.';

vi.mock('../../map/PlaceSearch', () => ({ PlaceSearch: () => <span>חיפוש</span> }));

function setup(props: Partial<Parameters<typeof MissionControlPanel>[0]> = {}) {
  const handlers = {
    onModeChange: vi.fn(),
    onPoint: vi.fn(),
    onPlaceFound: vi.fn(),
    onEnd: vi.fn(),
    onEdit: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <MissionControlPanel
      mission={mission}
      provider={{} as MapProvider}
      point={null}
      mode="map"
      busy={false}
      error={null}
      offline={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('MissionControlPanel: the missing person was located (UC-C16)', () => {
  it('shows the state of the mission and the form for "הנעדר אותר"', () => {
    setup();
    expect(screen.getByRole('region', { name: 'בקרת מסע' })).toBeInTheDocument();
    expect(screen.getByText('מצב: פעיל')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'הנעדר אותר' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /הערה/ })).toBeInTheDocument();
  });

  it('refuses to end without a place and says what is missing, without asking for confirmation', () => {
    const { onEnd } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'הנעדר אותר…' }));
    expect(screen.getByRole('alert')).toHaveTextContent('בחרו את המקום שבו הנעדר אותר.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('asks for confirmation and ends the mission with the place, the time and the note', () => {
    const { onEnd } = setup({ point: [35.14, 31.77] });
    fireEvent.change(screen.getByRole('textbox', { name: /הערה/ }), { target: { value: ' נמצא בהכרה ' } });
    fireEvent.click(screen.getByRole('button', { name: 'הנעדר אותר…' }));
    expect(screen.getByRole('dialog', { name: 'אישור סיום המסע' })).toHaveTextContent(
      'המעקב הבטיחותי נמשך עד סיום הפעילות של כל מחפש',
    );
    expect(onEnd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'אשר וסיים מסע' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0]?.[0]).toMatchObject({
      position: { type: 'Point', coordinates: [35.14, 31.77] },
      note: 'נמצא בהכרה',
    });
  });

  it('does not end when the commander cancels the confirmation', () => {
    const { onEnd } = setup({ point: [35.14, 31.77] });
    fireEvent.click(screen.getByRole('button', { name: 'הנעדר אותר…' }));
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('blocks ending without a connection, and while the end is being saved', () => {
    setup({ point: [35.14, 31.77], offline: true });
    expect(screen.getByRole('button', { name: 'הנעדר אותר…' })).toBeDisabled();
    expect(screen.getByText(/אין חיבור לשרת/)).toBeInTheDocument();
  });

  it('shows why the last attempt failed', () => {
    setup({ point: [35.14, 31.77], error: 'המסע לא הסתיים. נסו שוב.' });
    expect(screen.getByRole('alert')).toHaveTextContent('המסע לא הסתיים. נסו שוב.');
  });

  it('shows where and when the missing person was located, read-only, once the mission ended', () => {
    setup({
      mission: {
        ...mission,
        status: 'ended_located',
        located: {
          position: { type: 'Point', coordinates: [35.14, 31.77] },
          locatedAt: '2026-10-03T13:40:00.000Z',
          note: 'נמצא בהכרה',
          endedAt: '2026-10-03T13:45:00.000Z',
        },
      },
    });
    expect(screen.getByText('מצב: הסתיים: הנעדר אותר')).toBeInTheDocument();
    expect(screen.getByText('31.7700, 35.1400')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('נמצא בהכרה')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('says so when a mission ended another way', () => {
    setup({ mission: { ...mission, status: 'ended_stopped' } });
    expect(screen.getByText('המסע הסתיים ונשמר לקריאה בלבד.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('closes', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    expect(onClose).toHaveBeenCalled();
  });
});
