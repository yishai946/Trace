import { themes } from '@trace/design';
import type { Mission } from '@trace/schemas';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MissingPersonDetails } from '.';
import { formatDateTime } from '../../mission/missionArea';
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
    additionalInfo: 'סובל מבעיות זיכרון',
    photoUrl: null,
  },
  rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
  lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
};

beforeEach(() => useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true }));
afterEach(() => usePreferences.setState(usePreferences.getInitialState()));

const renderDetails = (m: Mission = mission) =>
  render(<MissingPersonDetails mission={m} closeAction={null} />, { wrapper: TestProviders });

describe('MissingPersonDetails', () => {
  it('shows everything the commander entered, read-only', () => {
    renderDetails();

    expect(screen.getByRole('heading', { name: 'נועם אברהם' })).toBeInTheDocument();
    expect(screen.getByText(/74/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatDateTime(mission.missingPerson.disappearedAt ?? '')))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatDateTime(mission.lkp?.observedAt ?? '')))).toBeInTheDocument();
    expect(screen.getByText('מעיל חום, כובע צמר אפור, מקל הליכה')).toBeInTheDocument();
    expect(screen.getByText('סובל מבעיות זיכרון')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('leaves out what the commander did not enter', () => {
    const empty = { name: null, age: null, disappearedAt: null, description: null, additionalInfo: null };
    renderDetails({ ...mission, lkp: null, missingPerson: { ...mission.missingPerson, ...empty } });

    expect(screen.getByRole('heading', { name: 'שם הנעדר לא הוזן' })).toBeInTheDocument();
    expect(screen.getByText('המנהל עוד לא הוסיף פרטים על הנעדר.')).toBeInTheDocument();
    expect(screen.queryByText('גיל')).toBeNull();
  });

  it.each(['night', 'day'] as const)('works in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    renderDetails();
    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: themes[id].color.surface });
  });
});
