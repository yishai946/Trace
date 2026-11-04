import type { Mission } from '@trace/schemas';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('shows each mission as a card that opens it', () => {
    const onOpen = vi.fn();
    render(<MissionsPage phone missions={missions} loadFailed={false} onOpen={onOpen} {...create} />);

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'המסעות שלי' })).toBeNull();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(cards[2]).toHaveTextContent('הסתיים, אותר');
    expect(cards[2]).toHaveTextContent('קריאה בלבד');
    expect(cards[0]).toHaveTextContent('AB-123');

    fireEvent.click(within(cards[1]!).getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('m2');
  });

  it('creates a mission from the button above the list', () => {
    const onNew = vi.fn();
    render(<MissionsPage phone missions={missions} loadFailed={false} onOpen={vi.fn()} onNew={onNew} canCreate />);

    fireEvent.click(screen.getByRole('button', { name: 'מסע חדש' }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
