import type { Mission } from '@trace/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionDetailsPage, type MissionDetailsPageProps } from '.';
import { mission as baseMission } from '../../mission/fixtures';
import { DETAILS_MESSAGES, PHOTO_SAVE_FAILED } from './missionDetailsForm';

// Shrinking needs a canvas; the stand-in keeps the file as it is.
vi.mock('../../components/PhotoPicker/shrinkPhoto', () => ({ shrinkPhoto: (file: File) => Promise.resolve(file) }));

const photoUrl = `/api/missions/${baseMission.id}/photo?v=1`;
const mission: Mission = {
  ...baseMission,
  missingPerson: { ...baseMission.missingPerson, description: 'מעיל חום' },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const apiError = (status: number, code: string) => json({ error: { code, message: 'x' } }, status);

function renderPage(props: Partial<MissionDetailsPageProps> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MissionDetailsPage
        mission={mission}
        commanderName="רונית לוי"
        searcherCount={3}
        online
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

const saveButton = () => screen.getByRole('button', { name: 'שמור שינויים' });
const field = (name: string) => screen.getByRole('textbox', { name });
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const chooseFile = (file = new File(['x'], 'photo.png', { type: 'image/png' })) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('No file input');
  fireEvent.change(input, { target: { files: [file] } });
  return file;
};

describe('MissionDetailsPage', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:new');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the mission as saved', () => {
    renderPage();
    expect(field('שם / מזהה מסע')).toHaveValue('מסע 0412');
    expect(field('שם הנעדר')).toHaveValue('נועם אברהם');
    expect(field('גיל')).toHaveValue('74');
    expect(field('תיאור / לבוש')).toHaveValue('מעיל חום');
    expect(screen.getByText('פעיל')).toBeInTheDocument();
    expect(screen.getByText('רונית לוי')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'קוד הצטרפות' })).toBeInTheDocument();
  });

  it('cannot save until something changes', () => {
    renderPage();
    expect(saveButton()).toBeDisabled();
    type('תיאור / לבוש', 'מעיל חום, כובע');
    expect(saveButton()).toBeEnabled();
    type('תיאור / לבוש', 'מעיל חום');
    expect(saveButton()).toBeDisabled();
  });

  it('saves the changes and says so', async () => {
    const saved = { ...mission, missingPerson: { ...mission.missingPerson, description: 'מעיל חום, כובע צמר' } };
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(saved));
    renderPage();
    type('תיאור / לבוש', 'מעיל חום, כובע צמר');
    fireEvent.click(saveButton());

    expect(await screen.findByText('השינויים נשמרו.')).toBeInTheDocument();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`/api/missions/${mission.id}/details`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'מסע 0412',
      missingPerson: {
        name: 'נועם אברהם',
        age: 74,
        disappearedAt: null,
        description: 'מעיל חום, כובע צמר',
        additionalInfo: null,
      },
    });
  });

  it('blocks saving while offline', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    renderPage({ online: false });
    type('תיאור / לבוש', 'מעיל חום, כובע');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('אין חיבור לשרת. אפשר לשמור כשהחיבור יחזור.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('marks a missing name and an impossible age, and sends nothing', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    renderPage();
    type('שם / מזהה מסע', '');
    type('גיל', '131');
    fireEvent.submit(screen.getByRole('form', { name: 'פרטי מסע ונעדר' }));
    expect(screen.getByText(DETAILS_MESSAGES.name)).toBeInTheDocument();
    expect(screen.getByText(DETAILS_MESSAGES.age)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('replaces the photo after saving the details', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(mission));
    renderPage({ mission: { ...mission, missingPerson: { ...mission.missingPerson, photoUrl } } });
    expect(screen.getByRole('img', { name: 'תמונת הנעדר' })).toHaveAttribute('src', photoUrl);
    const file = chooseFile();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [first, second] = fetch.mock.calls;
    expect(first?.[0]).toBe(`/api/missions/${mission.id}/details`);
    expect(second?.[0]).toBe(`/api/missions/${mission.id}/photo`);
    expect(second?.[1]?.method).toBe('PUT');
    expect(second?.[1]?.body).toBe(file);
    expect(second?.[1]?.headers).toMatchObject({ 'content-type': 'image/png' });
  });

  it('adds a photo to a mission whose upload failed at creation', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(mission));
    renderPage();
    expect(screen.getByRole('button', { name: 'הוסף תמונה' })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    chooseFile();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1]?.[0]).toBe(`/api/missions/${mission.id}/photo`);
  });

  it('says when the details were saved but the photo was not', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(mission))
      .mockResolvedValueOnce(apiError(500, 'INTERNAL_ERROR'));
    renderPage();
    chooseFile();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(PHOTO_SAVE_FAILED);
    expect(saveButton()).toBeEnabled();
  });

  it.each([
    ['the mission ended', () => apiError(409, 'MISSION_ENDED'), 'המסע הסתיים. אי אפשר לשמור שינויים.'],
    ['the network fails', () => Promise.reject(new TypeError('fetch failed')), 'אין חיבור לשרת. השינויים לא נשמרו.'],
  ])('explains a failed save when %s', async (_name, answer, message) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve().then(answer));
    renderPage();
    type('תיאור / לבוש', 'מעיל');
    fireEvent.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('shows an ended mission read only', () => {
    renderPage({
      mission: { ...mission, status: 'ended_stopped', missingPerson: { ...mission.missingPerson, photoUrl } },
    });
    expect(screen.queryByRole('button', { name: 'שמור שינויים' })).not.toBeInTheDocument();
    for (const name of ['שם / מזהה מסע', 'שם הנעדר', 'גיל', 'תיאור / לבוש', 'מידע רלוונטי']) {
      expect(field(name)).toHaveAttribute('readonly');
    }
    expect(screen.getByText('המסע הסתיים. הפרטים לקריאה בלבד.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'החלף' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'הוסף תמונה' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('form', { name: 'פרטי מסע ונעדר' })).getByRole('img', { name: 'תמונת הנעדר' }),
    ).toBeInTheDocument();
  });

  it('closes without saving', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const { onClose } = renderPage();
    type('תיאור / לבוש', 'מעיל חום, כובע');
    fireEvent.click(screen.getByRole('button', { name: 'בטל' }));
    expect(onClose).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
