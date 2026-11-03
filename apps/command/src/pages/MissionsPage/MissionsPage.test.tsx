import type { Mission } from '@trace/schemas';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MissionsPage } from '.';
import { formatOpened } from './missionStatus';
import { mission as baseMission } from '../../mission/fixtures';

const mission = (overrides: Partial<Mission>): Mission => ({ ...baseMission, ...overrides });

const missions: Mission[] = [
  mission({ id: 'm1', name: 'מסע 0412', status: 'active', joinCode: 'AB-123' }),
  mission({ id: 'm2', name: 'מסע 0410', status: 'paused', joinCode: 'CD-456' }),
  mission({ id: 'm3', name: 'מסע 0409', status: 'ended_located', joinCode: 'EF-789' }),
];

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('MissionsPage', () => {
  it("lists the commander's missions with their status and opens one", () => {
    const onOpen = vi.fn();
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={onOpen} />);

    expect(rows()).toHaveLength(3);
    expect(screen.getByText('הסתיים, אותר')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'פתח את מסע 0410' }));
    expect(onOpen).toHaveBeenCalledWith('m2');
  });

  it('opens a mission by clicking anywhere on its row', () => {
    const onOpen = vi.fn();
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={onOpen} />);

    fireEvent.click(screen.getByText('מסע 0409'));
    expect(onOpen).toHaveBeenCalledWith('m3');
  });

  it('filters by status, with a count on each tab', () => {
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'הסתיים 1' }));
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('מסע 0409')).toBeTruthy();
  });

  it('searches by mission name or join code', () => {
    render(<MissionsPage missions={missions} loadFailed={false} onOpen={vi.fn()} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'חיפוש מסע' }), { target: { value: 'cd-4' } });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('מסע 0410')).toBeTruthy();
  });

  it('explains an empty list and a failed load', () => {
    const { rerender } = render(<MissionsPage missions={[]} loadFailed={false} onOpen={vi.fn()} />);
    expect(screen.getByText(/אין לך מסעות עדיין/)).toBeTruthy();
    rerender(<MissionsPage missions={undefined} loadFailed onOpen={vi.fn()} />);
    expect(screen.getByText('לא ניתן לטעון מסעות מהשרת.')).toBeTruthy();
  });
});

describe('formatOpened', () => {
  const now = new Date(2026, 10, 1, 18, 0);

  it('reads today and yesterday by name, other days by date', () => {
    expect(formatOpened(new Date(2026, 10, 1, 11, 16).toISOString(), now)).toBe('היום 11:16');
    expect(formatOpened(new Date(2026, 9, 31, 22, 40).toISOString(), now)).toBe('אתמול 22:40');
    expect(formatOpened(new Date(2026, 9, 1, 14, 5).toISOString(), now)).toBe('01.10, 14:05');
    expect(formatOpened(new Date(2025, 9, 1, 14, 5).toISOString(), now)).toBe('01.10.2025');
  });
});
