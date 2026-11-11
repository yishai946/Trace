import { themes } from '@trace/design';
import type { Mission, OwnParticipation } from '@trace/schemas';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaitingForAssignment } from '.';
import { formatTime } from '../../mission/missionArea';
import { usePreferences } from '../../state/preferences';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const mission: Mission = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'מסע 0412',
  status: 'active',
  joinCode: 'K7-4Q2',
  missingPerson: {
    name: 'נועם אברהם',
    age: 74,
    disappearedAt: '2026-10-03T11:20:00+03:00',
    description: 'מעיל חום, כובע צמר אפור, מקל הליכה',
    additionalInfo: null,
    photoUrl: null,
  },
  rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
  lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
};
const participation: OwnParticipation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 7,
  status: 'available',
  polygonId: null,
  taskStatus: null,
};
const profile = { id: '6f1c5b3e-8d0a-4e57-9a43-0b0f5a1a2c11', phone: '+972523401187', name: 'דנה כהן' };

beforeEach(() => {
  useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(profile), { headers: { 'content-type': 'application/json' } })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  usePreferences.setState(usePreferences.getInitialState());
});

const renderScreen = (m: Mission = mission) =>
  render(<WaitingForAssignment mission={m} participation={participation} />, { wrapper: TestProviders });

describe('WaitingForAssignment', () => {
  it('tells the searcher they wait, with their callsign and name', async () => {
    renderScreen();
    const status = within(screen.getByLabelText('סטטוס שיבוץ'));

    expect(screen.getByRole('heading', { name: 'מסע 0412, נועם אברהם' })).toBeInTheDocument();
    expect(status.getByText('ממתין לשיבוץ מהמנהל')).toBeInTheDocument();
    expect(status.getByText('07')).toBeInTheDocument();
    expect(status.getByText('זמין')).toBeInTheDocument();
    expect(await status.findByText('דנה כהן')).toBeInTheDocument();
  });

  it('shows the missing person, the LKP and the rally point', () => {
    renderScreen();
    const person = within(screen.getByLabelText('פרטי הנעדר'));
    const map = within(screen.getByRole('img', { name: 'מפת המסע' }));

    expect(person.getByText(/נועם אברהם, .*74/)).toBeInTheDocument();
    expect(
      person.getByText(new RegExp(`נעלם .*${formatTime(mission.missingPerson.disappearedAt!)}`)),
    ).toBeInTheDocument();
    expect(person.getByText('מעיל חום, כובע צמר אפור, מקל הליכה')).toBeInTheDocument();
    expect(map.getByText(`LKP ${formatTime(mission.lkp!.observedAt)}`)).toBeInTheDocument();
    expect(map.getByText('נקודת כינוס')).toBeInTheDocument();
  });

  it('copes with a mission that has few details', () => {
    renderScreen({
      ...mission,
      lkp: null,
      missingPerson: { ...mission.missingPerson, name: null, age: null, disappearedAt: null, description: null },
    });

    expect(screen.getByRole('heading', { name: 'מסע 0412' })).toBeInTheDocument();
    expect(screen.getByText('שם הנעדר לא הוזן')).toBeInTheDocument();
    expect(screen.queryByText(/LKP/)).toBeNull();
  });

  it.each(['night', 'day'] as const)('works in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    renderScreen();

    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: themes[id].color.surface });
    expect(screen.getByLabelText('סטטוס שיבוץ')).toHaveStyle({ backgroundColor: themes[id].color.surfaceSunken });
  });
});
