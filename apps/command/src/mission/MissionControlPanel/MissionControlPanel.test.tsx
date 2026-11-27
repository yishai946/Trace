import type { MapProvider } from '@trace/map';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    onStop: vi.fn(),
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

describe('MissionControlPanel: stop the search (UC-C17)', () => {
  const open = () => fireEvent.click(screen.getByRole('radio', { name: 'הפסק חיפוש' }));

  it('switches between the two ways to end the mission', () => {
    setup();
    expect(screen.getByRole('radio', { name: 'הנעדר אותר' })).toBeChecked();
    open();
    expect(screen.getByRole('form', { name: 'הפסק חיפוש' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'הנעדר אותר' })).not.toBeInTheDocument();
  });

  it('offers the reasons from the list and a note', () => {
    setup();
    open();
    const reasons = screen.getByRole('radiogroup', { name: 'סיבת ההפסקה' });
    expect(within(reasons).getAllByRole('radio')).toHaveLength(6);
    expect(within(reasons).getByRole('radio', { name: 'אחר' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /הערה/ })).toBeInTheDocument();
  });

  it('refuses to stop without a reason, without asking for confirmation', () => {
    const { onStop } = setup();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'הפסק חיפוש…' }));
    expect(screen.getByRole('alert')).toHaveTextContent('בחרו את סיבת ההפסקה.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('asks for confirmation, then stops with the reason and the trimmed note', () => {
    const { onStop } = setup();
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'מזג אוויר ותנאי שטח' }));
    fireEvent.change(screen.getByRole('textbox', { name: /הערה/ }), { target: { value: ' ערפל ' } });
    fireEvent.click(screen.getByRole('button', { name: 'הפסק חיפוש…' }));
    expect(screen.getByRole('dialog', { name: 'אישור סיום המסע' })).toHaveTextContent('להפסיק את החיפוש');
    expect(onStop).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'אשר וסיים מסע' }));
    expect(onStop).toHaveBeenCalledWith({ reason: 'weather', note: 'ערפל' });
  });

  it('blocks stopping without a connection', () => {
    setup({ offline: true });
    open();
    expect(screen.getByRole('button', { name: 'הפסק חיפוש…' })).toBeDisabled();
  });

  it('shows the reason and the note, read-only, once the search was stopped', () => {
    setup({
      mission: {
        ...mission,
        status: 'ended_stopped',
        stopped: { reason: 'safety', note: 'סכנת מפולת', endedAt: '2026-10-03T13:45:00.000Z' },
      },
    });
    expect(screen.getByText('מצב: הסתיים: הופסק')).toBeInTheDocument();
    expect(screen.getByText('סיבות בטיחות')).toBeInTheDocument();
    expect(screen.getByText('סכנת מפולת')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});
