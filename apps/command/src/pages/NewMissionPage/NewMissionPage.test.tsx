import type { LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewMissionPage, type NewMissionPageProps } from '.';
import { mission } from '../../mission/fixtures';
import { MESSAGES } from './newMissionForm';
import { PHOTO_ERROR } from './PhotoPicker';
import { COORDS_ERROR } from './PointPicker';

const CLICKED: LngLat = [35.1335, 31.7835];

// The map needs WebGL; a stand-in reports a click at a fixed place while a point is being placed.
vi.mock('../../map/MissionMap', () => ({
  MissionMap: ({ onMapClick }: { onMapClick?: (point: LngLat) => void }) => (
    <button type="button" disabled={!onMapClick} onClick={() => onMapClick?.(CLICKED)}>
      לחיצה על המפה
    </button>
  ),
}));

const provider = {} as MapProvider;

function renderPage(props: Partial<NewMissionPageProps> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onCreated = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <NewMissionPage provider={provider} themeId="night" online onCancel={() => {}} onCreated={onCreated} {...props} />
    </QueryClientProvider>,
  );
  return { onCreated };
}

const points = () => within(screen.getByRole('group', { name: 'LKP ונקודת כינוס' }));
const rallySection = () => within(points().getByRole('region', { name: 'נקודת כינוס' }));
const createButton = () => screen.getByRole('button', { name: 'צור מסע' });

const lkpSection = () => within(points().getByRole('region', { name: 'LKP, נקודה אחרונה שבה נראה' }));

/** The LKP follows map clicks when the screen opens. `withTime` fills its date and time with the current moment. */
function placeLkpOnMap(withTime = true) {
  fireEvent.click(screen.getByRole('button', { name: 'לחיצה על המפה' }));
  if (!withTime) return;
  // Arrow up on each empty segment (day, month, year, hour, minute) takes the current value.
  for (const segment of lkpSection().getAllByRole('spinbutton')) fireEvent.keyDown(segment, { key: 'ArrowUp' });
}

function placeRallyOnMap() {
  fireEvent.click(rallySection().getByRole('tab', { name: 'מפה' }));
  fireEvent.click(screen.getByRole('button', { name: 'לחיצה על המפה' }));
}

describe('NewMissionPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('cannot create a mission until the LKP and rally point are set (decision 91)', () => {
    renderPage();
    expect(createButton()).toBeDisabled();
    expect(screen.getByText('חובה, לא הוגדר')).toBeInTheDocument();
    expect(screen.getByText('חובה, לא הוגדרה')).toBeInTheDocument();
    placeLkpOnMap();
    expect(createButton()).toBeDisabled();
    placeRallyOnMap();
    expect(createButton()).toBeEnabled();
    expect(rallySection().getByText('הוגדרה')).toBeInTheDocument();
  });

  it('names the mission after the missing person, and lets the commander rename it from the title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /מסע חדש/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'שם הנעדר' }), { target: { value: 'נועם אברהם' } });
    expect(screen.getByRole('heading', { name: /נועם אברהם/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /שם המסע/ }));
    const field = screen.getByRole('textbox', { name: 'שם המסע' });
    fireEvent.change(field, { target: { value: 'מסע 0412' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: /מסע 0412/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'שם הנעדר' }), { target: { value: 'נועם' } });
    expect(screen.getByRole('heading', { name: /מסע 0412/ })).toBeInTheDocument();
  });

  it('marks missing fields and does not send the form', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    renderPage();
    placeLkpOnMap(false);
    placeRallyOnMap();
    fireEvent.click(createButton());
    expect(screen.getByText(MESSAGES.lkpObservedAt)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.personName)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'שם הנעדר' })).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('places the rally point by coordinates', () => {
    renderPage();
    placeLkpOnMap();
    fireEvent.click(rallySection().getByRole('tab', { name: 'קואורדינטות' }));
    fireEvent.change(rallySection().getByRole('textbox', { name: 'קו רוחב' }), { target: { value: '31.7431' } });
    const lng = rallySection().getByRole('textbox', { name: 'קו אורך' });
    fireEvent.change(lng, { target: { value: '35.0127' } });
    fireEvent.blur(lng);
    expect(createButton()).toBeEnabled();
  });

  it('refuses out-of-range coordinates and shows the point that is really set', () => {
    renderPage();
    placeLkpOnMap();
    placeRallyOnMap();
    fireEvent.click(rallySection().getByRole('tab', { name: 'קואורדינטות' }));
    const lat = rallySection().getByRole('textbox', { name: 'קו רוחב' });
    fireEvent.change(lat, { target: { value: '231.7' } });
    fireEvent.blur(lat);
    expect(rallySection().getByText(COORDS_ERROR)).toBeInTheDocument();
    expect(lat).toHaveValue(String(CLICKED[1]));
  });

  it('only one point follows map clicks at a time', () => {
    renderPage();
    expect(lkpSection().getByRole('tab', { name: 'מפה' })).toHaveAttribute('aria-selected', 'true');
    placeRallyOnMap();
    expect(lkpSection().getByRole('tab', { name: 'מפה' })).toHaveAttribute('aria-selected', 'false');
    expect(lkpSection().getByText('חובה, לא הוגדר')).toBeInTheDocument();
  });

  it('creates the mission and hands it over to be opened', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(mission), { status: 201 }));
    const { onCreated } = renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: 'שם הנעדר' }), { target: { value: 'נועם אברהם' } });
    placeLkpOnMap();
    placeRallyOnMap();
    fireEvent.click(createButton());

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(mission, false));
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('/api/missions');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: 'נועם אברהם',
      rallyPoint: { type: 'Point', coordinates: CLICKED },
      lkp: {
        position: { type: 'Point', coordinates: CLICKED },
        observedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) as string,
      },
    });
  });

  it('refuses a photo that is not a JPEG, PNG or WebP image', () => {
    renderPage();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('No file input');
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(screen.getByText(PHOTO_ERROR)).toBeInTheDocument();
  });

  it('blocks creating a mission while offline', () => {
    renderPage({ online: false });
    placeRallyOnMap();
    expect(createButton()).toBeDisabled();
    expect(screen.getByText(/אין חיבור לשרת/)).toBeInTheDocument();
  });
});
