import { themes } from '@trace/design';
import type { Mission, MissionPolygon } from '@trace/schemas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SightingForm } from '.';
import { usePreferences } from '../../state/preferences';
import { TestProviders } from '../../test/providers';

const fix = vi.hoisted(() => ({
  current: { state: 'ready', fix: { position: [35.13, 31.78], accuracy: 5, at: 1 } } as object,
}));
vi.mock('../../location/useCurrentFix', () => ({ useCurrentFix: () => fix.current }));
const submit = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../../sightings/submit', () => ({ submitSighting: submit.fn }));
vi.mock('../MissionMap', () => ({
  MissionMap: ({
    onPressMap,
    marker,
    accessibilityLabel,
  }: {
    onPressMap?: (position: [number, number]) => void;
    marker?: { label: string } | null;
    accessibilityLabel?: string;
  }) => (
    <div role="img" aria-label={accessibilityLabel}>
      <button onClick={() => onPressMap?.([35.0139, 31.7412])}>סמן במפה</button>
      {marker ? <span>{marker.label}</span> : null}
    </div>
  ),
}));

const missionId = '00000000-0000-4000-8000-000000000001';
const mission: Mission = {
  id: missionId,
  name: 'מסע 0412',
  status: 'active',
  joinCode: 'K7-4Q2',
  missingPerson: {
    name: 'נועם אברהם',
    age: 74,
    disappearedAt: '2026-10-03T11:20:00+03:00',
    description: 'מעיל חום',
    additionalInfo: null,
    photoUrl: null,
  },
  rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
  lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
};
const polygon: MissionPolygon = {
  id: '00000000-0000-4000-8000-0000000000a1',
  missionId,
  name: 'A',
  status: 'active',
  coverage: null,
  activeSearchers: 1,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [35.0, 31.7],
        [35.02, 31.7],
        [35.02, 31.76],
        [35.0, 31.76],
        [35.0, 31.7],
      ],
    ],
  },
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
};

const onCancel = vi.fn();
const onDone = vi.fn();
const renderForm = (polygons: MissionPolygon[] = []) =>
  render(
    <SightingForm
      missionId={missionId}
      mission={mission}
      polygons={polygons}
      assignedPolygonId={null}
      onCancel={onCancel}
      onDone={onDone}
    />,
    { wrapper: TestProviders },
  );
const stripBidi = (text: string | null) => (text ?? '').replace(/[⁦⁩]/g, '');
const send = () => fireEvent.click(screen.getByRole('button', { name: 'שלח תצפית' }));

beforeEach(() => {
  fix.current = { state: 'ready', fix: { position: [35.13, 31.78], accuracy: 5, at: 1 } };
  submit.fn.mockReset().mockResolvedValue('sent');
  onCancel.mockReset();
  onDone.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  usePreferences.setState(usePreferences.getInitialState());
});

describe('SightingForm', () => {
  it('shows the Fm09 fields with their defaults', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'תצפית על הנעדר' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'אני ראיתי' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'המיקום שלי' })).toBeChecked();
    expect(screen.getByRole('img', { name: 'מפת מיקום התצפית' })).toBeInTheDocument();
    expect((screen.getByLabelText('זמן התצפית') as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/);
    expect(screen.getByLabelText('תיאור קצר')).toHaveValue('');
    expect(screen.getByText('התצפית תופיע מיד במפה של המנהל')).toBeInTheDocument();
  });

  it('sends the place, time, description and source', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 17, 0, 0));
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: 'עד ראייה' }));
    fireEvent.change(screen.getByLabelText('זמן התצפית'), { target: { value: '16:58' } });
    fireEvent.change(screen.getByLabelText('תיאור קצר'), { target: { value: 'אדם עם כובע אפור' } });
    send();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(submit.fn).toHaveBeenCalledWith({
      missionId,
      sighting: {
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        position: { type: 'Point', coordinates: [35.13, 31.78] },
        observedAt: new Date(2026, 9, 3, 16, 58).toISOString(),
        source: 'witness',
        description: 'אדם עם כובע אפור',
      },
    });
  });

  it('takes a point picked on the map, switches to it and sends it', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'סמן במפה' }));
    expect(screen.getByRole('radio', { name: 'בחירה במפה' })).toBeChecked();
    expect(stripBidi(screen.getByText(/31\.7412/).textContent)).toContain('31.7412, 35.0139');
    expect(screen.getByText('תצפית')).toBeInTheDocument();
    send();
    await waitFor(() => expect(submit.fn).toHaveBeenCalled());
    expect(submit.fn.mock.calls[0]![0].sighting.position.coordinates).toEqual([35.0139, 31.7412]);
  });

  it('names the polygon the place is in', () => {
    renderForm([polygon]);
    fireEvent.click(screen.getByRole('button', { name: 'סמן במפה' }));
    expect(stripBidi(screen.getByText(/31\.7412/).textContent)).toBe('31.7412, 35.0139, פוליגון A');
  });

  it('says it is locating, and when the location is unavailable', () => {
    fix.current = { state: 'locating', fix: null };
    const { unmount } = renderForm();
    expect(screen.getByText('מאתר את המיקום שלך…')).toBeInTheDocument();
    unmount();
    fix.current = { state: 'unavailable', fix: null };
    renderForm();
    expect(screen.getByText('המיקום שלך לא זמין. בחר את המקום במפה.')).toBeInTheDocument();
  });

  it('asks to tap the map while no point is picked', () => {
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: 'בחירה במפה' }));
    expect(screen.getByText('הקש על המפה במקום שבו נראה הנעדר.')).toBeInTheDocument();
  });

  it('keeps the picked point when going back to my location and again', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'סמן במפה' }));
    fireEvent.click(screen.getByRole('radio', { name: 'המיקום שלי' }));
    expect(stripBidi(screen.getByText(/31\.78/).textContent)).toContain('31.7800, 35.1300');
    fireEvent.click(screen.getByRole('radio', { name: 'בחירה במפה' }));
    expect(stripBidi(screen.getByText(/31\.7412/).textContent)).toContain('31.7412, 35.0139');
  });

  it('does not send without a position', () => {
    fix.current = { state: 'unavailable', fix: null };
    renderForm();
    send();
    expect(screen.getByRole('alert')).toHaveTextContent('בחר את מקום התצפית במפה, או המתן למיקום שלך.');
    expect(submit.fn).not.toHaveBeenCalled();
  });

  it('refuses a time that is not a time of day', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('זמן התצפית'), { target: { value: '25:00' } });
    send();
    expect(screen.getByRole('alert')).toHaveTextContent('הזן שעה כמו 16:58.');
    expect(screen.getByLabelText('זמן התצפית')).toHaveAttribute('aria-invalid', 'true');
    expect(submit.fn).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('זמן התצפית'), { target: { value: '16:5' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('puts the time of now with the "עכשיו" button', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 17, 42, 0));
    renderForm();
    fireEvent.change(screen.getByLabelText('זמן התצפית'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'עכשיו' }));
    expect(screen.getByLabelText('זמן התצפית')).toHaveValue('17:42');
  });

  it('keeps the sighting on the phone when there is no connection, and goes back to the map', async () => {
    submit.fn.mockResolvedValue('pending');
    renderForm();
    send();
    expect(
      await screen.findByText('אין חיבור. התצפית נשמרה בטלפון ותישלח אוטומטית כשהחיבור יחזור.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'חזרה למפה' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('says when the server refused the sighting for good', async () => {
    submit.fn.mockResolvedValue('rejected');
    renderForm();
    send();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'התצפית לא נשלחה: המסע הסתיים או שהפעילות שלך בו הסתיימה.',
    );
    expect(screen.getByRole('button', { name: 'חזרה למפה' })).toBeInTheDocument();
  });

  it('says when the sighting could not be saved on the phone, and lets the searcher try again', async () => {
    submit.fn.mockRejectedValue(new Error('disk full'));
    renderForm();
    send();
    expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לשמור את התצפית בטלפון. נסה שוב.');
    expect(screen.getByRole('button', { name: 'שלח תצפית' })).toBeEnabled();
  });

  it('does not send twice while sending', async () => {
    let finish: (value: string) => void = () => {};
    submit.fn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm();
    send();
    const sending = await screen.findByRole('button', { name: 'שולח…' });
    expect(sending).toBeDisabled();
    fireEvent.click(sending);
    expect(submit.fn).toHaveBeenCalledTimes(1);
    await act(async () => finish('sent'));
  });

  it('closes without sending', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(submit.fn).not.toHaveBeenCalled();
  });

  it.each(['night', 'day'] as const)('raises the checked choices and marks errors in the %s theme', (id) => {
    usePreferences.setState({ themePreference: id });
    fix.current = { state: 'unavailable', fix: null };
    renderForm();
    expect(screen.getByRole('radio', { name: 'אני ראיתי' })).toHaveStyle({
      backgroundColor: themes[id].color.surfaceRaised,
    });
    send();
    expect(screen.getByRole('alert')).toHaveStyle({ borderColor: themes[id].color.warning });
  });
});
