import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinishActivityControls } from '.';
import { TestProviders } from '../../test/providers';

const fix = vi.hoisted(() => ({ current: { state: 'locating', fix: null } as unknown }));
vi.mock('../../location/useCurrentFix', () => ({ useCurrentFix: () => fix.current }));

const RALLY: [number, number] = [35.13, 31.78];
const at = (position: [number, number]) => ({ state: 'ready', fix: { position, accuracy: 5, at: 0 } });
const renderControls = (props: Partial<Parameters<typeof FinishActivityControls>[0]> = {}) =>
  render(
    <TestProviders>
      <FinishActivityControls rallyPoint={RALLY} pending={false} error={null} {...props} />
    </TestProviders>,
  );
const open = () => fireEvent.click(screen.getByRole('button', { name: 'סיימתי פעילות…' }));

beforeEach(() => {
  fix.current = at(RALLY);
});

describe('FinishActivityControls (UC-F15)', () => {
  it('asks to confirm, says what ending means, and finishes only after the confirmation', () => {
    const onFinish = vi.fn();
    renderControls({ onFinish });
    open();
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText(/מעקב המיקום ייפסק/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'סיים פעילות' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('warns without blocking when the searcher is far from the Rally Point', () => {
    fix.current = at([35.14, 31.78]);
    const onFinish = vi.fn();
    renderControls({ onFinish });
    open();
    expect(screen.getByText(/עדיין רחוק מנקודת הכינוס/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'סיים פעילות' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not warn near the Rally Point', () => {
    renderControls({ onFinish: () => {} });
    open();
    expect(screen.queryByText(/רחוק מנקודת הכינוס/)).not.toBeInTheDocument();
  });

  it('recommends the Rally Point, never blocks, when the position is unknown', () => {
    fix.current = { state: 'unavailable', fix: null };
    const onFinish = vi.fn();
    renderControls({ onFinish });
    open();
    expect(screen.getByText(/לא הצלחנו לקבוע את מיקומך/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'סיים פעילות' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not wait for the position: the confirmation works while it is still being taken', () => {
    fix.current = { state: 'locating', fix: null };
    const onFinish = vi.fn();
    renderControls({ onFinish });
    open();
    expect(screen.getByRole('button', { name: 'סיים פעילות' })).toBeEnabled();
  });

  it('goes back without finishing on cancel', () => {
    const onFinish = vi.fn();
    renderControls({ onFinish });
    open();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(screen.getByRole('button', { name: 'סיימתי פעילות…' })).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('blocks a second tap while it is on its way and shows why it failed', () => {
    renderControls({ onFinish: () => {}, pending: true, error: 'אין חיבור לשרת.' });
    open();
    expect(screen.getByRole('button', { name: 'סיים פעילות' })).toBeDisabled();
    expect(screen.getByText('אין חיבור לשרת.')).toBeInTheDocument();
  });
});
