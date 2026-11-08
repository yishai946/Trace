import type { LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Place } from '../../map/geocoding';
import { COORDS_ERROR } from '../../map/PlacePicker';
import { RallyPointPanel } from '.';

const FOUND: Place = { id: 'p1', name: 'נחל עמוד', description: 'נחל עמוד, ישראל', center: [35.5, 32.9] };

// The search calls a geocoding service; a stand-in picks a fixed place.
vi.mock('../../map/PlaceSearch', () => ({
  PlaceSearch: ({ onSelect }: { onSelect: (place: Place) => void }) => (
    <button type="button" onClick={() => onSelect(FOUND)}>
      בחירת מקום
    </button>
  ),
}));

const point: LngLat = [35.1335, 31.7835];

function setup(props: Partial<Parameters<typeof RallyPointPanel>[0]> = {}) {
  const handlers = { onChange: vi.fn(), onPlaceFound: vi.fn(), onModeChange: vi.fn(), onClose: vi.fn() };
  render(
    <RallyPointPanel
      provider={{} as MapProvider}
      point={point}
      mode="map"
      busy={false}
      error={null}
      saved={false}
      blocked={null}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('RallyPointPanel', () => {
  it('shows the current point and that it is active', () => {
    setup();
    expect(screen.getByRole('region', { name: 'נקודת כינוס' })).toBeInTheDocument();
    expect(screen.getByText('פעילה')).toBeInTheDocument();
    expect(screen.getByText('31.7835, 35.1335')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('שינוי כינוס')).toBeInTheDocument();
  });

  it('changes by map by default, with a hint to click', () => {
    setup();
    expect(screen.getByRole('tab', { name: 'מפה' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('לחצו על המפה להזזת הנקודה.')).toBeInTheDocument();
  });

  it('says the change reaches Field at once, and offline searchers on their next connection (decision 92)', () => {
    setup();
    expect(screen.getByText('מתעדכן מיד ב-Field. מחפש לא מקוון יקבל בחיבור הבא.')).toBeInTheDocument();
  });

  it('changes the point to valid typed coordinates', () => {
    const { onChange } = setup({ mode: 'coords' });
    fireEvent.change(screen.getByRole('textbox', { name: 'קו רוחב' }), { target: { value: '31.7431' } });
    const lng = screen.getByRole('textbox', { name: 'קו אורך' });
    fireEvent.change(lng, { target: { value: '35.0127' } });
    fireEvent.blur(lng);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([35.0127, 31.7431]);
  });

  it('refuses invalid coordinates and puts the fields back', () => {
    const { onChange } = setup({ mode: 'coords' });
    const lat = screen.getByRole('textbox', { name: 'קו רוחב' });
    fireEvent.change(lat, { target: { value: '91' } });
    fireEvent.blur(lat);
    expect(screen.getByText(COORDS_ERROR)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(lat).toHaveValue('31.7835');
  });

  it('changes the point to a found place and moves the map there', () => {
    const { onChange, onPlaceFound } = setup({ mode: 'search' });
    fireEvent.click(screen.getByRole('button', { name: 'בחירת מקום' }));
    expect(onChange).toHaveBeenCalledWith(FOUND.center);
    expect(onPlaceFound).toHaveBeenCalledWith(FOUND);
  });

  it.each([
    ['ended', 'אי אפשר לשנות נקודת כינוס במסע שהסתיים.'],
    ['offline', 'אין חיבור לשרת. אפשר לשנות כשהחיבור יחזור.'],
  ] as const)('explains why it cannot change when %s, and offers no way to', (blocked, notice) => {
    setup({ blocked });
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('31.7835, 35.1335')).toBeInTheDocument();
  });

  it('ignores a change while one is being saved', () => {
    const { onChange } = setup({ busy: true, mode: 'search' });
    expect(screen.getByText('מעדכן…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'בחירת מקום' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a failure as an alert and a success as a status', () => {
    setup({ error: 'אין חיבור לשרת. נקודת הכינוס לא נשמרה.' });
    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לשרת. נקודת הכינוס לא נשמרה.');
  });

  it('confirms a saved change', () => {
    setup({ saved: true });
    expect(screen.getByRole('status')).toHaveTextContent('נקודת הכינוס עודכנה.');
  });

  it('closes', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    expect(onClose).toHaveBeenCalled();
  });
});
