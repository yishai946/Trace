import { themes } from '@trace/design';
import type { MissionPolygon, OwnParticipation } from '@trace/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssignedTask } from '.';
import { usePreferences } from '../../state/preferences';
import { TestProviders } from '../../test/providers';

const polygon = (id: string, name: string, activeSearchers: number): MissionPolygon => ({
  id,
  missionId: '00000000-0000-4000-8000-000000000001',
  name,
  status: 'active',
  coverage: null,
  activeSearchers,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [35, 31.7],
        [35.01, 31.7],
        [35.01, 31.71],
        [35, 31.7],
      ],
    ],
  },
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
});
const polygons = [
  polygon('00000000-0000-4000-8000-0000000000a1', 'ואדי צפוני', 7),
  polygon('00000000-0000-4000-8000-0000000000b2', 'מדרון דרומי', 1),
];
const participation: OwnParticipation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status: 'assigned',
  polygonId: polygons[0]?.id ?? null,
  taskStatus: 'ready',
};

afterEach(() => usePreferences.setState(usePreferences.getInitialState()));
const renderTask = (props: Partial<Parameters<typeof AssignedTask>[0]> = {}) =>
  render(
    <AssignedTask
      participation={participation}
      polygons={polygons}
      notice={null}
      onDismissNotice={() => {}}
      {...props}
    />,
    { wrapper: TestProviders },
  );

describe('AssignedTask', () => {
  it('shows the assigned polygon and waits for Start Search', () => {
    renderTask();
    expect(screen.getByText('שובצת לפוליגון ואדי צפוני')).toBeInTheDocument();
    expect(screen.getByText('7 מחפשים בפוליגון')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeDisabled();
  });

  it('tells the searcher they were moved, until they dismiss it', () => {
    const onDismissNotice = vi.fn();
    renderTask({
      participation: { ...participation, polygonId: polygons[1]?.id ?? null },
      notice: { kind: 'moved', polygonId: polygons[1]?.id ?? '' },
      onDismissNotice,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('הועברת לפוליגון מדרון דרומי. המשימה הקודמת נשמרה.');
    expect(screen.getByText('מחפש אחד בפוליגון')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הבנתי' }));
    expect(onDismissNotice).toHaveBeenCalled();
  });

  it('says it without a name while the polygons load', () => {
    renderTask({ polygons: [], notice: { kind: 'moved', polygonId: participation.polygonId ?? '' } });
    expect(screen.getByText('שובצת לפוליגון')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('הועברת לפוליגון. המשימה הקודמת נשמרה.');
  });

  it.each(['night', 'day'] as const)('works in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    renderTask({ notice: { kind: 'assigned', polygonId: polygons[0]?.id ?? '' } });
    expect(screen.getByRole('alert')).toHaveStyle({ borderColor: themes[id].color.accent });
  });
});
