import type { Mission } from '@trace/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MissionSwitcher } from '.';
import { mission } from '../../mission/fixtures';

const other: Mission = {
  ...mission,
  id: '00000000-0000-4000-8000-000000000002',
  name: 'מסע 0410',
  status: 'paused',
  missingPerson: { ...mission.missingPerson, name: 'דנה לוי' },
};

function renderSwitcher() {
  const onSelect = vi.fn();
  const onShowAll = vi.fn();
  render(<MissionSwitcher mission={mission} missions={[mission, other]} onSelect={onSelect} onShowAll={onShowAll} />);
  fireEvent.click(screen.getByRole('button', { name: /מסע: נועם אברהם, פעיל/ }));
  return { onSelect, onShowAll };
}

describe('MissionSwitcher', () => {
  it("names the mission by its missing person and lists the commander's missions", () => {
    renderSwitcher();
    expect(screen.getByText('המסעות שלי')).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: /דנה לוי/ })).not.toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: /נועם אברהם/ })).toBeChecked();
  });

  it('switches to another mission', () => {
    const { onSelect } = renderSwitcher();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /דנה לוי/ }));
    expect(onSelect).toHaveBeenCalledWith(other.id);
  });

  it('does nothing when the current mission is chosen', () => {
    const { onSelect } = renderSwitcher();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /נועם אברהם/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('goes to the full mission list', () => {
    const { onShowAll } = renderSwitcher();
    fireEvent.click(screen.getByRole('menuitem', { name: 'כל המסעות' }));
    expect(onShowAll).toHaveBeenCalledOnce();
  });
});
