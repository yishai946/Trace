import type { Mission } from '@trace/schemas';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionsPage } from '.';
import { mission as baseMission } from '../../mission/fixtures';

const mission = (overrides: Partial<Mission>): Mission => ({ ...baseMission, ...overrides });

const missions: Mission[] = [
  mission({ id: 'm1', name: 'מסע 0412', status: 'active', joinCode: 'AB-123' }),
  mission({ id: 'm2', name: 'מסע 0410', status: 'paused', joinCode: 'CD-456' }),
  mission({ id: 'm3', name: 'מסע 0409', status: 'ended_located', joinCode: 'EF-789' }),
];

const create = { onNew: () => {}, canCreate: true };

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('MissionsPage', () => {
  it("lists the commander's missions with their status and opens one", () => {
    const onOpen = vi.fn();
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={onOpen} {...create} />);

    expect(rows()).toHaveLength(3);
    expect(screen.getByText('הסתיים, אותר')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'פתח את מסע 0410' }));
    expect(onOpen).toHaveBeenCalledWith('m2');
  });

  it('opens a mission by clicking anywhere on its row', () => {
    const onOpen = vi.fn();
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={onOpen} {...create} />);

    fireEvent.click(screen.getByText('מסע 0409'));
    expect(onOpen).toHaveBeenCalledWith('m3');
  });

  it('filters by status, with a count on each tab', () => {
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={vi.fn()} {...create} />);

    fireEvent.click(screen.getByRole('tab', { name: 'הסתיים 1' }));
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('מסע 0409')).toBeTruthy();
  });

  it('searches by mission name or join code', () => {
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={vi.fn()} {...create} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'חיפוש מסע' }), { target: { value: 'cd-4' } });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('מסע 0410')).toBeTruthy();
  });

  it('opens the new-mission screen, only while connected', () => {
    const onNew = vi.fn();
    const { rerender } = render(
      <MissionsPage missions={missions} loadFailed={false} onOpen={vi.fn()} onNew={onNew} canCreate />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'מסע חדש' }));
    expect(onNew).toHaveBeenCalled();
    rerender(<MissionsPage missions={missions} loadFailed={false} onOpen={vi.fn()} onNew={onNew} canCreate={false} />);
    expect(screen.getByRole('button', { name: 'מסע חדש' })).toBeDisabled();
  });

  it('explains an empty list and a failed load', () => {
    const { rerender } = render(<MissionsPage missions={[]} loadFailed={false} onOpen={vi.fn()} {...create} />);
    expect(screen.getByText(/אין לך מסעות עדיין/)).toBeTruthy();
    rerender(<MissionsPage missions={undefined} loadFailed onOpen={vi.fn()} {...create} />);
    expect(screen.getByText('לא ניתן לטעון מסעות מהשרת.')).toBeTruthy();
  });
});

describe('MissionsPage on the phone', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const list = [
    mission({
      id: 'm1',
      name: 'מסע 0412',
      status: 'active',
      joinCode: 'AB-123',
      missingPerson: { ...baseMission.missingPerson, name: 'נועם אברהם', age: 74 },
    }),
    mission({
      id: 'm2',
      name: 'מסע 0410',
      status: 'paused',
      joinCode: 'CD-456',
      missingPerson: { ...baseMission.missingPerson, name: null, age: null },
    }),
    mission({ id: 'm3', name: 'מסע 0409', status: 'ended_located', joinCode: 'EF-789' }),
  ];
  const card = (index: number) => screen.getAllByRole('listitem')[index] as HTMLElement;
  const props = { missions: list, loadFailed: false, onOpen: vi.fn(), ...create };

  it('lists the missions as cards, not a table', () => {
    render(<MissionsPage {...props} />);

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^מסע 0412/ })).toBeTruthy();
  });

  it('shows the status and the missing person on each card', () => {
    render(<MissionsPage {...props} />);

    expect(within(card(0)).getByText('פעיל')).toBeTruthy();
    expect(within(card(0)).getByText('נועם אברהם, 74')).toBeTruthy();
    expect(within(card(1)).getByText('—')).toBeTruthy();
  });

  it('marks ended missions read-only', () => {
    render(<MissionsPage {...props} />);

    expect(within(card(0)).getByText(/^נפתח/)).toBeTruthy();
    expect(within(card(0)).queryByText(/קריאה בלבד/)).toBeNull();
    expect(within(card(2)).getByText(/^נפתח.*קריאה בלבד$/)).toBeTruthy();
  });

  it('opens a mission from its card', () => {
    const onOpen = vi.fn();
    render(<MissionsPage {...props} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: /^מסע 0410/ }));
    expect(onOpen).toHaveBeenCalledWith('m2');
  });

  it('filters by status and searches by name or join code', () => {
    render(<MissionsPage {...props} />);

    fireEvent.click(screen.getByRole('tab', { name: 'הסתיים 1' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'הכול 3' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'חיפוש מסע' }), { target: { value: 'cd-4' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'חיפוש מסע' }), { target: { value: '0412' } });
    expect(screen.getByRole('button', { name: /^מסע 0412/ })).toBeTruthy();
  });

  it('opens the new-mission screen, only while connected', () => {
    const onNew = vi.fn();
    const { rerender } = render(<MissionsPage {...props} onNew={onNew} canCreate />);
    fireEvent.click(screen.getByRole('button', { name: 'מסע חדש' }));
    expect(onNew).toHaveBeenCalled();
    rerender(<MissionsPage {...props} onNew={onNew} canCreate={false} />);
    expect(screen.getByRole('button', { name: 'מסע חדש' })).toBeDisabled();
  });

  it('shows the title and the top bar slot', () => {
    render(<MissionsPage {...props} phoneBar={<span>פרופיל</span>} />);

    expect(screen.getByRole('heading', { level: 1, name: 'המסעות שלי' })).toBeTruthy();
    expect(screen.getByText('פרופיל')).toBeTruthy();
  });

  it('explains loading, a failed load, an empty list and an empty filter', () => {
    const { rerender } = render(<MissionsPage {...props} missions={undefined} />);
    expect(screen.getByText('טוען מסעות…')).toBeTruthy();
    rerender(<MissionsPage {...props} missions={undefined} loadFailed />);
    expect(screen.getByText('לא ניתן לטעון מסעות מהשרת.')).toBeTruthy();
    rerender(<MissionsPage {...props} missions={[]} />);
    expect(screen.getByText(/אין לך מסעות עדיין/)).toBeTruthy();
    rerender(<MissionsPage {...props} missions={list.slice(0, 1)} />);
    fireEvent.click(screen.getByRole('tab', { name: 'הסתיים 0' }));
    expect(screen.getByText('אין מסעות שמתאימים לסינון.')).toBeTruthy();
  });

  it('leaves out what the API does not provide yet', () => {
    render(<MissionsPage {...props} />);

    expect(screen.queryByText(/מחפשים/)).toBeNull();
    expect(screen.queryByText(/Coverage/i)).toBeNull();
  });
});

describe('MissionsPage on the desktop', () => {
  it('does not render the phone top bar slot', () => {
    render(
      <MissionsPage
        missions={missions}
        loadFailed={false}
        onOpen={vi.fn()}
        {...create}
        phoneBar={<span>פרופיל</span>}
      />,
    );

    expect(screen.queryByText('פרופיל')).toBeNull();
  });
});
